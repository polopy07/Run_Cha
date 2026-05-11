import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RankingService } from './ranking.service';
import { Territory } from '../territories/entities/territory.entity';
import { User } from '../users/entities/user.entity';

const mockTerritoryRepo = () => ({
  createQueryBuilder: jest.fn(),
});

const mockUserRepo = () => ({
  createQueryBuilder: jest.fn(),
});

describe('RankingService', () => {
  let service: RankingService;
  let territoryRepo: ReturnType<typeof mockTerritoryRepo>;
  let userRepo: ReturnType<typeof mockUserRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RankingService,
        { provide: getRepositoryToken(Territory), useFactory: mockTerritoryRepo },
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
      ],
    }).compile();

    service = module.get<RankingService>(RankingService);
    territoryRepo = module.get(getRepositoryToken(Territory));
    userRepo = module.get(getRepositoryToken(User));
  });

  describe('getAreaRanking', () => {
    it('면적 기준 내림차순으로 rank를 부여한다', async () => {
      const rawRows = [
        { userId: 1, nickname: 'alice', totalAreaSqm: '5000.5' },
        { userId: 2, nickname: 'bob',   totalAreaSqm: '3000.0' },
      ];

      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rawRows),
      };
      territoryRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getAreaRanking();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ rank: 1, userId: 1, nickname: 'alice', totalAreaSqm: 5000.5 });
      expect(result[1]).toEqual({ rank: 2, userId: 2, nickname: 'bob',   totalAreaSqm: 3000.0 });
    });

    it('영토가 없으면 빈 배열을 반환한다', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      territoryRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getAreaRanking();
      expect(result).toEqual([]);
    });

    it('occupation_rate > 0 조건으로 where를 호출한다', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      territoryRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getAreaRanking();
      expect(qb.where).toHaveBeenCalledWith('t.occupation_rate > 0');
    });
  });

  describe('getDistanceRanking', () => {
    it('누적 거리 기준 내림차순으로 rank를 부여한다', async () => {
      const users = [
        { id: 3, nickname: 'carol', total_distance: 200.5 },
        { id: 1, nickname: 'alice', total_distance: 150.0 },
      ] as User[];

      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(users),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getDistanceRanking();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ rank: 1, userId: 3, nickname: 'carol', totalDistanceKm: 200.5 });
      expect(result[1]).toEqual({ rank: 2, userId: 1, nickname: 'alice', totalDistanceKm: 150.0 });
    });

    it('러닝 기록이 없으면 빈 배열을 반환한다', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getDistanceRanking();
      expect(result).toEqual([]);
    });

    it('total_distance > 0 조건으로 where를 호출한다', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      userRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getDistanceRanking();
      expect(qb.where).toHaveBeenCalledWith('u.total_distance > 0');
    });
  });
});
