import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import * as turf from '@turf/turf';
import { RunningLog } from './entities/running-log.entity';
import { User } from '../users/entities/user.entity';
import { Territory } from '../territories/entities/territory.entity';
import { FinishRunningDto } from './dto/finish-running.dto';
import { calcCenter } from '../common/utils/geo';
import { EventsGateway } from '../socket/events.gateway';
import { CharacterType } from '../characters/entities/character.entity';
import { UserCharacter } from '../characters/entities/user-character.entity';
import {
  getCharacterMaxLevel,
  getCharacterNextLevelExperience,
  getCharacterStatMaxLevel,
} from '../characters/character-level.util';
import { NEW_TERRITORY_PROTECTION_MS } from '../attacks/attack-timing.constants';

const PACE_MULTIPLIER: Record<string, number> = {
  fast_walk: 0.6,
  jog: 0.8,
  run: 1.0,
  fast_run: 1.2,
};

const DISTANCE_POINT_RATE = 100;
const NON_CLOSED_BONUS_MULTIPLIER = 1.3;
const DISTANCE_BONUS_BASE = 1.1;
const DISTANCE_BONUS_CAP = 3.0;

const MIN_VALID_SPEED_KMH = 4;
const MAX_VALID_SPEED_KMH = 20;
const RUNNING_LOG_LIST_LIMIT = 20;
const REPRESENTATIVE_CHARACTER_EXP_PER_KM = 20;

type IncreasedStat = 'attack' | 'defense' | 'point' | null;

type RepresentativeCharacterExpResult = {
  userCharacterId: number;
  gainedExp: number;
  level: number;
  experience: number;
  nextLevelExperience: number | null;
  levelUps: number;
  increasedStat: IncreasedStat;
} | null;

type RunningLogSummary = {
  id: number;
  distanceKm: number;
  earnedPoints: number;
  avgPace: number;
  areaSqm: number;
  startedAt: Date;
  endedAt: Date | null;
};

@Injectable()
export class RunningService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async findMine(userId: number): Promise<RunningLogSummary[]> {
    const logs = await this.dataSource.getRepository(RunningLog).find({
      where: { user_id: userId },
      order: { started_at: 'DESC', id: 'DESC' },
      take: RUNNING_LOG_LIST_LIMIT,
    });

    return logs.map((log) => this.toRunningLogSummary(log));
  }

  async finish(userId: number, dto: FinishRunningDto) {
    const { path, territory_name } = dto;
    const endedAt = new Date();
    const startedAt = new Date(dto.started_at);

    this.validatePath(path);

    if (startedAt > endedAt) {
      throw new BadRequestException('유효하지 않은 시작 시간입니다.');
    }
    if (endedAt.getTime() - startedAt.getTime() > 24 * 60 * 60 * 1000) {
      throw new BadRequestException('유효하지 않은 시작 시간입니다.');
    }

    const durationHours =
      (endedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60);

    if (durationHours <= 0) {
      throw new BadRequestException(
        '러닝 시작 시간은 종료 시간보다 이전이어야 합니다.',
      );
    }

    const distanceKm = this.calculateDistanceKm(path);
    const avgSpeedKmh = distanceKm / durationHours;
    const avgPace = distanceKm > 0 ? (durationHours * 60) / distanceKm : 0;

    const closed = this.isClosedLoop(path);
    const speedValid = this.isValidSpeed(avgSpeedKmh);
    const paceMultiplier = speedValid ? this.getPaceMultiplier(avgPace) : 0;
    const area_sqm = closed ? this.calculateArea(path) : 0;
    const distanceMultiplier = Math.min(
      Math.pow(DISTANCE_BONUS_BASE, distanceKm),
      DISTANCE_BONUS_CAP,
    );
    const basePoints = Math.floor(
      distanceKm * DISTANCE_POINT_RATE * paceMultiplier * distanceMultiplier,
    );
    const earned_points = closed
      ? basePoints
      : Math.floor(basePoints * NON_CLOSED_BONUS_MULTIPLIER);

    const { savedLog, territory, representativeCharacterExp } =
      await this.dataSource.transaction(async (manager) => {
        const log = manager.create(RunningLog, {
          user_id: userId,
          path,
          distance_km: distanceKm,
          earned_points,
          area_sqm,
          avg_pace: avgPace,
          started_at: startedAt,
          ended_at: endedAt,
        });
        const savedLog = await manager.save(log);

        await manager
          .createQueryBuilder()
          .update(User)
          .set({
            total_distance: () => 'total_distance + :dist',
            points: () => 'points + :pts',
          })
          .where('id = :id', { id: userId })
          .setParameter('dist', distanceKm)
          .setParameter('pts', earned_points)
          .execute();

        const representativeCharacterExp =
          await this.grantRepresentativeCharacterExp(
            manager,
            userId,
            distanceKm,
          );

        let territory: Territory | null = null;
        if (area_sqm > 0) {
          const center = calcCenter(path);
          territory = await manager.save(
            manager.create(Territory, {
              user_id: userId,
              name: territory_name ?? null,
              coordinates: path,
              area_sqm,
              occupation_rate: 100,
              center_lat: center.lat,
              center_lng: center.lng,
              protected_until: new Date(
                endedAt.getTime() + NEW_TERRITORY_PROTECTION_MS,
              ),
            }),
          );
        }

        return { savedLog, territory, representativeCharacterExp };
      });

    this.eventsGateway.broadcastRankingUpdate();
    if (territory) {
      this.eventsGateway.broadcastTerritoryUpdate(
        territory.center_lat,
        territory.center_lng,
      );
    }

    return {
      log: savedLog,
      territory: territory ?? null,
      earned_points,
      area_sqm,
      representativeCharacterExp,
    };
  }

  private async grantRepresentativeCharacterExp(
    manager: EntityManager,
    userId: number,
    distanceKm: number,
  ): Promise<RepresentativeCharacterExpResult> {
    if (distanceKm <= 0) {
      return null;
    }

    const gainedExp = Math.max(
      1,
      Math.floor(distanceKm * REPRESENTATIVE_CHARACTER_EXP_PER_KM),
    );
    const user = await manager.findOne(User, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!user?.representative_character_id) {
      return null;
    }

    const userCharacter = await manager.getRepository(UserCharacter).findOne({
      where: {
        id: user.representative_character_id,
        user_id: userId,
      },
      relations: { character: true },
      lock: { mode: 'pessimistic_write' },
    });

    if (!userCharacter?.character) {
      return null;
    }

    const maxLevel = getCharacterMaxLevel(userCharacter.character.grade);
    let levelUps = 0;
    let increasedStat: IncreasedStat = null;

    userCharacter.experience += gainedExp;

    while (
      userCharacter.level < maxLevel &&
      userCharacter.experience >=
        getCharacterNextLevelExperience(userCharacter.level)
    ) {
      userCharacter.experience -= getCharacterNextLevelExperience(
        userCharacter.level,
      );
      userCharacter.level += 1;
      levelUps += 1;
      increasedStat = this.increaseTypePrimaryStat(userCharacter);
    }

    if (userCharacter.level >= maxLevel) {
      userCharacter.experience = 0;
    }

    await manager.getRepository(UserCharacter).save(userCharacter);

    return {
      userCharacterId: userCharacter.id,
      gainedExp,
      level: userCharacter.level,
      experience: userCharacter.experience,
      nextLevelExperience:
        userCharacter.level >= maxLevel
          ? null
          : getCharacterNextLevelExperience(userCharacter.level),
      levelUps,
      increasedStat,
    };
  }

  private increaseTypePrimaryStat(userCharacter: UserCharacter): IncreasedStat {
    const maxStatLevel = getCharacterStatMaxLevel(
      userCharacter.character.grade,
    );

    if (
      userCharacter.character.type === CharacterType.ATTACK &&
      userCharacter.attack_lv < maxStatLevel
    ) {
      userCharacter.attack_lv += 1;
      return 'attack';
    }

    if (
      userCharacter.character.type === CharacterType.DEFENSE &&
      userCharacter.defense_lv < maxStatLevel
    ) {
      userCharacter.defense_lv += 1;
      return 'defense';
    }

    if (
      userCharacter.character.type === CharacterType.BUFF &&
      userCharacter.point_lv < maxStatLevel
    ) {
      userCharacter.point_lv += 1;
      return 'point';
    }

    return null;
  }

  private validatePath(path: { lat: number; lng: number }[]): void {
    if (path.length < 2) {
      throw new BadRequestException('path must contain at least two points');
    }

    const invalid = path.some(
      ({ lat, lng }) =>
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180,
    );

    if (invalid) {
      throw new BadRequestException('path contains invalid coordinates');
    }
  }

  private calculateDistanceKm(path: { lat: number; lng: number }[]): number {
    if (path.length < 2) return 0;

    const coordinates = path.map((point) => [point.lng, point.lat]);
    const line = turf.lineString(coordinates);

    return turf.length(line, { units: 'kilometers' });
  }

  private calculateArea(path: { lat: number; lng: number }[]): number {
    if (path.length < 3) return 0;

    const coords = path.map((p) => [p.lng, p.lat] as [number, number]);
    if (
      coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1]
    ) {
      coords.push(coords[0]);
    }

    const polygon = turf.polygon([coords]);
    return turf.area(polygon);
  }

  private isClosedLoop(path: { lat: number; lng: number }[]): boolean {
    if (path.length < 3) return false;
    const start = turf.point([path[0].lng, path[0].lat]);
    const end = turf.point([
      path[path.length - 1].lng,
      path[path.length - 1].lat,
    ]);
    return turf.distance(start, end, { units: 'meters' }) <= 50;
  }

  private isValidSpeed(speedKmh: number): boolean {
    return speedKmh >= MIN_VALID_SPEED_KMH && speedKmh <= MAX_VALID_SPEED_KMH;
  }

  private getPaceMultiplier(avgPace: number): number {
    if (avgPace < 3) return 0;
    if (avgPace <= 4) return PACE_MULTIPLIER.fast_run;
    if (avgPace <= 5) return PACE_MULTIPLIER.run;
    if (avgPace <= 7) return PACE_MULTIPLIER.jog;
    if (avgPace <= 8) return PACE_MULTIPLIER.fast_walk;
    return 0;
  }

  private toRunningLogSummary(log: RunningLog): RunningLogSummary {
    return {
      id: log.id,
      distanceKm: log.distance_km,
      earnedPoints: log.earned_points,
      avgPace: log.avg_pace,
      areaSqm: log.area_sqm,
      startedAt: log.started_at,
      endedAt: log.ended_at,
    };
  }
}
