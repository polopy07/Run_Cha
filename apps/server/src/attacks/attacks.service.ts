import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  EntityManager,
  MoreThan,
  Repository,
} from 'typeorm';
import { calculateAttackOutcome } from './attack-calculator';
import { calculateAttackOverlap, mergePolygons } from './attack-overlap';
import { AttackTerritoryDto } from './dto/attack-territory.dto';
import { AttackLog } from './entities/attack-log.entity';
import { AttackResult } from './enums/attack-result.enum';
import { CharacterType } from '../characters/entities/character.entity';
import { UserCharacter } from '../characters/entities/user-character.entity';
import { calcCenter } from '../common/utils/geo';
import { RunningLog } from '../running/entities/running-log.entity';
import { Territory } from '../territories/entities/territory.entity';
import { EventsGateway } from '../socket/events.gateway';

const MIN_ATTACK_OVERLAP_RATE = 30;
const DAILY_ATTACK_LIMIT = 5;
const NEUTRAL_AREA_SQM_PENDING_POLICY = 0;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AttackTerritoryResponse = {
  success: boolean;
  overlapRate: number;
  contestedAreaSqm: number;
  damage: number;
  occupationRateBefore: number;
  occupationRateAfter: number;
  acquiredAreaSqm: number;
  neutralAreaSqm: number;
  nextAttackAvailableAt: string | null;
  remainingDailyAttacks: number;
  message: string;
};

@Injectable()
export class AttacksService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Territory)
    private readonly territoriesRepository: Repository<Territory>,
    @InjectRepository(RunningLog)
    private readonly runningLogsRepository: Repository<RunningLog>,
    @InjectRepository(UserCharacter)
    private readonly userCharactersRepository: Repository<UserCharacter>,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async attack(
    userId: number,
    territoryId: number,
    dto: AttackTerritoryDto,
  ): Promise<AttackTerritoryResponse> {
    const [territory, runningLog, attackerCharacter] = await Promise.all([
      this.findTargetTerritory(territoryId),
      this.findRunningLog(dto.runningLogId, userId),
      this.findAttackerCharacter(dto.attackerCharacterId, userId),
    ]);

    if (territory.user_id === userId) {
      throw new BadRequestException('자신의 영토는 침략할 수 없습니다.');
    }

    const overlap = this.calculateOverlapOrThrow(runningLog, territory);
    const { overlapRate, contestedAreaSqm } = overlap;

    if (overlapRate < MIN_ATTACK_OVERLAP_RATE) {
      throw new BadRequestException(
        `대상 영토의 ${MIN_ATTACK_OVERLAP_RATE}% 이상을 직접 러닝해야 합니다.`,
      );
    }

    const deployedDefenders = await this.userCharactersRepository.find({
      where: { deployed_territory_id: territory.id },
      relations: { character: true },
      order: { id: 'ASC' },
    });

    const outcome = calculateAttackOutcome({
      attackerCharacter,
      deployedDefenders,
      territory,
    });

    if (outcome.success && overlap.contestedCoordinates) {
      await this.ensureAttackerTerritoryExists(userId);
    }

    let remainingDailyAttacks = 0;

    await this.dataSource.transaction(async (manager) => {
      const territoryRepo = manager.getRepository(Territory);
      const attackLogRepo = manager.getRepository(AttackLog);
      const lockKey = this.buildDailyAttackLockKey(userId);

      await this.acquireDailyAttackLock(manager, lockKey);

      try {
        const dailyAttackCount = await this.countTodayAttacks(
          attackLogRepo,
          userId,
        );
        if (dailyAttackCount >= DAILY_ATTACK_LIMIT) {
          throw new BadRequestException(
            '오늘의 침략 가능 횟수를 모두 사용했습니다.',
          );
        }

        const runningLogAttackCount = await attackLogRepo.count({
          where: {
            attacker_id: userId,
            running_log_id: runningLog.id,
          },
        });
        if (runningLogAttackCount > 0) {
          throw new BadRequestException('이미 침략에 사용한 러닝 기록입니다.');
        }

        territory.occupation_rate = outcome.occupationRateAfter;
        if (outcome.success && overlap.contestedCoordinates) {
          await this.transferContestedTerritory(
            territoryRepo,
            territory,
            overlap,
            userId,
          );
        } else {
          await territoryRepo.save(territory);
        }

        await attackLogRepo.save(
          attackLogRepo.create({
            attacker_id: userId,
            defender_id: territory.user_id,
            territory_id: territory.id,
            running_log_id: runningLog.id,
            attacker_character_id: attackerCharacter.id,
            defender_character_id: deployedDefenders[0]?.id ?? null,
            result: outcome.success
              ? AttackResult.ATTACKER_WIN
              : AttackResult.DEFENDER_WIN,
            occupation_rate_before: outcome.occupationRateBefore,
            occupation_rate_after: outcome.occupationRateAfter,
          }),
        );

        remainingDailyAttacks = Math.max(
          0,
          DAILY_ATTACK_LIMIT - dailyAttackCount - 1,
        );
      } finally {
        await this.releaseDailyAttackLock(manager, lockKey);
      }
    });

    if (outcome.success) {
      this.eventsGateway.broadcastTerritoryUpdate(
        territory.center_lat,
        territory.center_lng,
      );
    }

    return {
      success: outcome.success,
      overlapRate,
      contestedAreaSqm,
      damage: outcome.damage,
      occupationRateBefore: outcome.occupationRateBefore,
      occupationRateAfter: outcome.occupationRateAfter,
      acquiredAreaSqm: outcome.success ? contestedAreaSqm : 0,
      neutralAreaSqm: NEUTRAL_AREA_SQM_PENDING_POLICY,
      nextAttackAvailableAt: null,
      remainingDailyAttacks,
      message: outcome.success
        ? '침략에 성공했습니다.'
        : '방어력이 높아 점령률이 감소하지 않았습니다.',
    };
  }

  private async findTargetTerritory(territoryId: number) {
    const territory = await this.territoriesRepository.findOne({
      where: { id: territoryId },
    });

    if (!territory) {
      throw new NotFoundException('영토를 찾을 수 없습니다.');
    }

    return territory;
  }

  private calculateOverlapOrThrow(
    runningLog: RunningLog,
    territory: Territory,
  ) {
    try {
      return calculateAttackOverlap(
        runningLog.path,
        territory.coordinates,
        territory.area_sqm,
      );
    } catch (error) {
      if (error instanceof Error) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  private async transferContestedTerritory(
    territoryRepo: Repository<Territory>,
    defenderTerritory: Territory,
    overlap: ReturnType<typeof calculateAttackOverlap>,
    attackerId: number,
  ) {
    if (
      overlap.defenderRemainingCoordinates &&
      overlap.defenderRemainingAreaSqm > 0
    ) {
      const defenderCenter = calcCenter(overlap.defenderRemainingCoordinates);
      defenderTerritory.coordinates = overlap.defenderRemainingCoordinates;
      defenderTerritory.area_sqm = overlap.defenderRemainingAreaSqm;
      defenderTerritory.center_lat = defenderCenter.lat;
      defenderTerritory.center_lng = defenderCenter.lng;
    } else {
      defenderTerritory.area_sqm = 0;
      defenderTerritory.occupation_rate = 0;
    }

    await territoryRepo.save(defenderTerritory);

    const attackerCoordinates = overlap.contestedCoordinates;
    if (!attackerCoordinates || overlap.contestedAreaSqm <= 0) {
      return;
    }

    const attackerTerritory = await this.findAttackerTerritoryForMergeWithLock(
      territoryRepo,
      attackerId,
    );
    const merged = mergePolygons(
      attackerTerritory.coordinates,
      attackerCoordinates,
    );

    if (!merged.coordinates || merged.areaSqm <= 0) {
      throw new BadRequestException('Failed to merge contested territory.');
    }

    const attackerCenter = calcCenter(merged.coordinates);
    attackerTerritory.coordinates = merged.coordinates;
    attackerTerritory.area_sqm = merged.areaSqm;
    attackerTerritory.center_lat = attackerCenter.lat;
    attackerTerritory.center_lng = attackerCenter.lng;

    await territoryRepo.save(attackerTerritory);
  }

  private async findAttackerTerritoryForMerge(
    territoryRepo: Repository<Territory>,
    attackerId: number,
    lock?: { mode: 'pessimistic_write' },
  ) {
    const attackerTerritory = await territoryRepo.findOne({
      where: {
        user_id: attackerId,
        area_sqm: MoreThan(0),
        occupation_rate: MoreThan(0),
      },
      order: { last_active_at: 'DESC', id: 'DESC' },
      lock,
    });

    if (!attackerTerritory) {
      throw new BadRequestException(
        '침략하려면 먼저 자신의 영토가 있어야 합니다.',
      );
    }

    return attackerTerritory;
  }

  private ensureAttackerTerritoryExists(attackerId: number) {
    return this.findAttackerTerritoryForMerge(
      this.territoriesRepository,
      attackerId,
    );
  }

  private findAttackerTerritoryForMergeWithLock(
    territoryRepo: Repository<Territory>,
    attackerId: number,
  ) {
    return this.findAttackerTerritoryForMerge(territoryRepo, attackerId, {
      mode: 'pessimistic_write',
    });
  }

  private async findRunningLog(runningLogId: number, userId: number) {
    const runningLog = await this.runningLogsRepository.findOne({
      where: { id: runningLogId, user_id: userId },
    });

    if (!runningLog) {
      throw new NotFoundException('러닝 기록을 찾을 수 없습니다.');
    }

    return runningLog;
  }

  private async findAttackerCharacter(userCharacterId: number, userId: number) {
    const userCharacter = await this.userCharactersRepository.findOne({
      where: { id: userCharacterId, user_id: userId },
      relations: { character: true },
    });

    if (!userCharacter) {
      throw new NotFoundException('보유 캐릭터를 찾을 수 없습니다.');
    }

    if (userCharacter.character.type !== CharacterType.ATTACK) {
      throw new BadRequestException(
        '공격형 캐릭터만 침략에 사용할 수 있습니다.',
      );
    }

    return userCharacter;
  }

  private countTodayAttacks(
    attackLogRepo: Repository<AttackLog>,
    userId: number,
  ) {
    const { start, end } = getKstDayRange();

    return attackLogRepo.count({
      where: {
        attacker_id: userId,
        created_at: Between(start, end),
      },
    });
  }

  private buildDailyAttackLockKey(userId: number) {
    return `attack:${userId}:${getKstDateKey()}`;
  }

  private async acquireDailyAttackLock(
    manager: EntityManager,
    lockKey: string,
  ) {
    const rows: { acquired: number | string | null }[] = await manager.query(
      'SELECT GET_LOCK(?, 5) AS acquired',
      [lockKey],
    );

    if (Number(rows[0]?.acquired) !== 1) {
      throw new BadRequestException(
        '침략 요청을 처리하는 중입니다. 잠시 후 다시 시도해주세요.',
      );
    }
  }

  private async releaseDailyAttackLock(
    manager: EntityManager,
    lockKey: string,
  ) {
    await manager.query('SELECT RELEASE_LOCK(?)', [lockKey]);
  }
}

export function getKstDayRange(now = new Date()) {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  const startKst = new Date(kstNow);
  startKst.setUTCHours(0, 0, 0, 0);

  const start = new Date(startKst.getTime() - KST_OFFSET_MS);
  const end = new Date(start.getTime() + DAY_MS - 1);

  return { start, end };
}

function getKstDateKey(now = new Date()) {
  const kstNow = new Date(now.getTime() + KST_OFFSET_MS);
  return kstNow.toISOString().slice(0, 10);
}
