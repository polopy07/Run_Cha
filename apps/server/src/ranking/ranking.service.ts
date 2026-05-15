import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Territory } from '../territories/entities/territory.entity';
import { User } from '../users/entities/user.entity';

export interface AreaRankingEntry {
  rank: number;
  userId: number;
  nickname: string;
  totalAreaSqm: number;
}

export interface DistanceRankingEntry {
  rank: number;
  userId: number;
  nickname: string;
  totalDistanceKm: number;
}

export interface AreaRankingResponse {
  rankings: AreaRankingEntry[];
  myRank: AreaRankingEntry | null;
}

export interface DistanceRankingResponse {
  rankings: DistanceRankingEntry[];
  myRank: DistanceRankingEntry | null;
}

@Injectable()
export class RankingService {
  constructor(
    @InjectRepository(Territory)
    private readonly territoryRepo: Repository<Territory>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getAreaRanking(userId?: number): Promise<AreaRankingResponse> {
    const rows = await this.territoryRepo
      .createQueryBuilder('t')
      .select('t.user_id', 'userId')
      .addSelect('u.nickname', 'nickname')
      .addSelect('SUM(t.area_sqm)', 'totalAreaSqm')
      .innerJoin('t.user', 'u')
      .where('t.occupation_rate > 0')
      .groupBy('t.user_id')
      .addGroupBy('u.nickname')
      .orderBy('totalAreaSqm', 'DESC')
      .getRawMany<{ userId: number; nickname: string; totalAreaSqm: string }>();

    const rankings = rows.map((row, i) => ({
      rank: i + 1,
      userId: Number(row.userId),
      nickname: row.nickname,
      totalAreaSqm: parseFloat(row.totalAreaSqm),
    }));

    const myRank = userId
      ? (rankings.find((r) => r.userId === userId) ?? null)
      : null;

    return { rankings, myRank };
  }

  async getDistanceRanking(userId?: number): Promise<DistanceRankingResponse> {
    const users = await this.userRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.nickname', 'u.total_distance'])
      .where('u.total_distance > 0')
      .orderBy('u.total_distance', 'DESC')
      .getMany();

    const rankings = users.map((u, i) => ({
      rank: i + 1,
      userId: u.id,
      nickname: u.nickname,
      totalDistanceKm: u.total_distance,
    }));

    const myRank = userId
      ? (rankings.find((r) => r.userId === userId) ?? null)
      : null;

    return { rankings, myRank };
  }
}
