import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Feature, Polygon } from 'geojson';
import { Between, DataSource, Repository } from 'typeorm';
import * as turf from '@turf/turf';
import { calculateAttackOutcome } from './attack-calculator';
import { AttackTerritoryDto } from './dto/attack-territory.dto';
import { AttackLog } from './entities/attack-log.entity';
import { AttackResult } from './enums/attack-result.enum';
import { CharacterType } from '../characters/entities/character.entity';
import { UserCharacter } from '../characters/entities/user-character.entity';
import { RunningLog } from '../running/entities/running-log.entity';
import { Territory } from '../territories/entities/territory.entity';

const MIN_ATTACK_OVERLAP_RATE = 30;
const DAILY_ATTACK_LIMIT = 5;

type Coordinate = { lat: number; lng: number };

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
    @InjectRepository(AttackLog)
    private readonly attackLogsRepository: Repository<AttackLog>,
  ) {}

  async attack(
    userId: number,
    territoryId: number,
    dto: AttackTerritoryDto,
  ): Promise<AttackTerritoryResponse> {
    const [territory, runningLog, attackerCharacter, dailyAttackCount] =
      await Promise.all([
        this.findTargetTerritory(territoryId),
        this.findRunningLog(dto.runningLogId, userId),
        this.findAttackerCharacter(dto.attackerCharacterId, userId),
        this.countTodayAttacks(userId),
      ]);

    if (territory.user_id === userId) {
      throw new BadRequestException('자신의 영토는 침략할 수 없습니다.');
    }

    if (dailyAttackCount >= DAILY_ATTACK_LIMIT) {
      throw new BadRequestException(
        '오늘의 침략 가능 횟수를 모두 사용했습니다.',
      );
    }

    const { overlapRate, contestedAreaSqm } = this.calculateOverlap(
      runningLog.path,
      territory.coordinates,
      territory.area_sqm,
    );

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

    await this.dataSource.transaction(async (manager) => {
      const territoryRepo = manager.getRepository(Territory);
      const attackLogRepo = manager.getRepository(AttackLog);

      territory.occupation_rate = outcome.occupationRateAfter;
      await territoryRepo.save(territory);

      await attackLogRepo.save(
        attackLogRepo.create({
          attacker_id: userId,
          defender_id: territory.user_id,
          territory_id: territory.id,
          attacker_character_id: attackerCharacter.id,
          defender_character_id: deployedDefenders[0]?.id ?? null,
          result: outcome.success
            ? AttackResult.ATTACKER_WIN
            : AttackResult.DEFENDER_WIN,
          occupation_rate_before: outcome.occupationRateBefore,
          occupation_rate_after: outcome.occupationRateAfter,
        }),
      );
    });

    return {
      success: outcome.success,
      overlapRate,
      contestedAreaSqm,
      damage: outcome.damage,
      occupationRateBefore: outcome.occupationRateBefore,
      occupationRateAfter: outcome.occupationRateAfter,
      acquiredAreaSqm: outcome.acquiredAreaSqm,
      neutralAreaSqm: 0,
      nextAttackAvailableAt: null,
      remainingDailyAttacks: Math.max(
        0,
        DAILY_ATTACK_LIMIT - dailyAttackCount - 1,
      ),
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

  private countTodayAttacks(userId: number) {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return this.attackLogsRepository.count({
      where: {
        attacker_id: userId,
        created_at: Between(start, end),
      },
    });
  }

  private calculateOverlap(
    runningPath: Coordinate[],
    territoryCoordinates: Coordinate[],
    territoryAreaSqm: number,
  ) {
    const runningPolygon = this.toPolygon(runningPath);
    const territoryPolygon = this.toPolygon(territoryCoordinates);
    const intersection = turf.intersect(
      turf.featureCollection([runningPolygon, territoryPolygon]),
    );
    const contestedAreaSqm = intersection ? turf.area(intersection) : 0;
    const overlapRate =
      territoryAreaSqm > 0 ? (contestedAreaSqm / territoryAreaSqm) * 100 : 0;

    return { overlapRate, contestedAreaSqm };
  }

  private toPolygon(coordinates: Coordinate[]): Feature<Polygon> {
    if (coordinates.length < 3) {
      throw new BadRequestException('폐곡선 좌표가 부족합니다.');
    }

    const ring = coordinates.map((coord) => [coord.lng, coord.lat]);
    const first = ring[0];
    const last = ring[ring.length - 1];

    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push(first);
    }

    return turf.polygon([ring]);
  }
}
