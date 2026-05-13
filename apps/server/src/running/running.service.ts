import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as turf from '@turf/turf';
import { RunningLog } from './entities/running-log.entity';
import { User } from '../users/entities/user.entity';
import { TerritoriesService } from '../territories/territories.service';
import { FinishRunningDto } from './dto/finish-running.dto';

const PACE_MULTIPLIER: Record<string, number> = {
  fast_walk: 0.6,  // 7~8분/km
  jog: 0.8,        // 5~7분/km
  run: 1.0,        // 4~5분/km
  fast_run: 1.2,   // 3~4분/km
};

@Injectable()
export class RunningService {
  constructor(
    @InjectRepository(RunningLog)
    private readonly runningLogRepo: Repository<RunningLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly territoriesService: TerritoriesService,
  ) {}

  async finish(userId: number, dto: FinishRunningDto) {
    const { path, distance_km, avg_pace } = dto;

    const closed = this.isClosedLoop(path);
    const paceMultiplier = this.getPaceMultiplier(avg_pace);
    // 열린 경로는 영토/포인트 없음
    const area_sqm = closed ? this.calculateArea(path) : 0;
    const earned_points = closed ? Math.floor((area_sqm / 100) * paceMultiplier) : 0;

    const log = this.runningLogRepo.create({
      user_id: userId,
      path,
      distance_km,
      earned_points,
      avg_pace,
      ended_at: new Date(),
    });
    const savedLog = await this.runningLogRepo.save(log);

    await this.userRepo.increment({ id: userId }, 'total_distance', distance_km);
    if (earned_points > 0) {
      await this.userRepo.increment({ id: userId }, 'points', earned_points);
    }

    // 폐곡선이 완성된 경우에만 영토 등록 (시작점-끝점 거리 50m 이내)
    const territory =
      area_sqm > 0
        ? await this.territoriesService.registerTerritory(userId, path, area_sqm)
        : null;

    return {
      log: savedLog,
      territory: territory ?? null,
      earned_points,
      area_sqm,
    };
  }

  private calculateArea(path: { lat: number; lng: number }[]): number {
    if (path.length < 3) return 0;

    const coords = path.map((p) => [p.lng, p.lat] as [number, number]);
    // turf는 첫 좌표와 끝 좌표가 같아야 polygon을 만듦
    if (coords[0][0] !== coords[coords.length - 1][0]) {
      coords.push(coords[0]);
    }

    const polygon = turf.polygon([coords]);
    return turf.area(polygon); // 제곱미터 반환
  }

  private isClosedLoop(path: { lat: number; lng: number }[]): boolean {
    if (path.length < 3) return false;
    const start = turf.point([path[0].lng, path[0].lat]);
    const end = turf.point([path[path.length - 1].lng, path[path.length - 1].lat]);
    return turf.distance(start, end, { units: 'meters' }) <= 50;
  }

  // avg_pace: 분/km
  private getPaceMultiplier(avgPace: number): number {
    if (avgPace < 3) return 0;          // 무효
    if (avgPace <= 4) return PACE_MULTIPLIER.fast_run;
    if (avgPace <= 5) return PACE_MULTIPLIER.run;
    if (avgPace <= 7) return PACE_MULTIPLIER.jog;
    if (avgPace <= 8) return PACE_MULTIPLIER.fast_walk;
    return 0;                           // 무효 (너무 느림)
  }
}
