import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TerritoryDecayService } from './territory-decay.service';
import { Territory } from '../territories/entities/territory.entity';

type QueryParams = Record<string, unknown>;

type QueryBuilderMock = {
  update: jest.Mock<QueryBuilderMock, []>;
  set: jest.Mock<QueryBuilderMock, [Record<string, unknown>]>;
  where: jest.Mock<QueryBuilderMock, [string, QueryParams?]>;
  andWhere: jest.Mock<QueryBuilderMock, [string, QueryParams?]>;
  execute: jest.Mock<Promise<{ affected: number }>, []>;
};

type DecayQueryBuilders = [
  QueryBuilderMock,
  QueryBuilderMock,
  QueryBuilderMock,
  QueryBuilderMock,
];

function makeQb(): QueryBuilderMock {
  const qb = {} as QueryBuilderMock;
  qb.update = jest.fn(() => qb);
  qb.set = jest.fn<QueryBuilderMock, [Record<string, unknown>]>(() => qb);
  qb.where = jest.fn<QueryBuilderMock, [string, QueryParams?]>(() => qb);
  qb.andWhere = jest.fn<QueryBuilderMock, [string, QueryParams?]>(() => qb);
  qb.execute = jest.fn<Promise<{ affected: number }>, []>(() =>
    Promise.resolve({ affected: 0 }),
  );

  return qb;
}

describe('TerritoryDecayService', () => {
  let service: TerritoryDecayService;
  let mockRepo: { createQueryBuilder: jest.Mock<QueryBuilderMock, []> };

  beforeEach(async () => {
    mockRepo = { createQueryBuilder: jest.fn<QueryBuilderMock, []>() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TerritoryDecayService,
        { provide: getRepositoryToken(Territory), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<TerritoryDecayService>(TerritoryDecayService);
  });

  function setupQbs(affected = [0, 0, 0, 0]): DecayQueryBuilders {
    const qbs: DecayQueryBuilders = [makeQb(), makeQb(), makeQb(), makeQb()];
    qbs.forEach((qb, i) => {
      qb.execute.mockResolvedValue({ affected: affected[i] });
    });
    mockRepo.createQueryBuilder
      .mockReturnValueOnce(qbs[0]) // neutralize to 0%
      .mockReturnValueOnce(qbs[1]) // update to 25%
      .mockReturnValueOnce(qbs[2]) // update to 50%
      .mockReturnValueOnce(qbs[3]); // update to 75%
    return qbs;
  }

  describe('배치 쿼리 구조', () => {
    it('DELETE 없이 UPDATE 4개를 발행한다', async () => {
      const [neutralizeQb, qb25, qb50, qb75] = setupQbs();

      await service.handleDecay();

      expect(neutralizeQb.update).toHaveBeenCalled();
      expect(qb25.update).toHaveBeenCalled();
      expect(qb50.update).toHaveBeenCalled();
      expect(qb75.update).toHaveBeenCalled();
      expect(neutralizeQb).not.toHaveProperty('delete');
    });

    it('각 UPDATE는 목표 occupation_rate와 last_active_at 보존으로 SET을 호출한다', async () => {
      const [neutralizeQb, qb25, qb50, qb75] = setupQbs();

      await service.handleDecay();

      expect(neutralizeQb.set).toHaveBeenCalledWith({
        occupation_rate: 0,
        last_active_at: expect.any(Function) as unknown,
      });
      expect(qb25.set).toHaveBeenCalledWith({
        occupation_rate: 25,
        last_active_at: expect.any(Function) as unknown,
      });
      expect(qb50.set).toHaveBeenCalledWith({
        occupation_rate: 50,
        last_active_at: expect.any(Function) as unknown,
      });
      expect(qb75.set).toHaveBeenCalledWith({
        occupation_rate: 75,
        last_active_at: expect.any(Function) as unknown,
      });
    });

    it('각 UPDATE는 빈 영토와 이미 더 낮은 점령률 영토를 제외한다', async () => {
      const [neutralizeQb, qb25, qb50, qb75] = setupQbs();

      await service.handleDecay();

      for (const [qb, occupationRate] of [
        [neutralizeQb, 0],
        [qb25, 25],
        [qb50, 50],
        [qb75, 75],
      ] as const) {
        expect(qb.where).toHaveBeenCalledWith('area_sqm > 0');
        expect(qb.andWhere).toHaveBeenCalledWith(
          'occupation_rate > :occupationRate',
          { occupationRate },
        );
      }
    });
  });

  describe('경계값 조건', () => {
    it('0% 중립화 구간은 22일 기준으로 처리한다', async () => {
      const [neutralizeQb] = setupQbs();

      await service.handleDecay();

      expect(neutralizeQb.andWhere).toHaveBeenCalledWith(
        'last_active_at <= :cutoff',
        { cutoff: expect.any(Date) as unknown },
      );
      expect(neutralizeQb.andWhere).not.toHaveBeenCalledWith(
        'last_active_at > :previousCutoff',
        expect.any(Object),
      );
    });

    it('25% 구간은 15일 이하부터 22일 초과 사이다', async () => {
      const [, qb25] = setupQbs();

      await service.handleDecay();

      expect(qb25.andWhere).toHaveBeenCalledWith('last_active_at <= :cutoff', {
        cutoff: expect.any(Date) as unknown,
      });
      expect(qb25.andWhere).toHaveBeenCalledWith(
        'last_active_at > :previousCutoff',
        { previousCutoff: expect.any(Date) as unknown },
      );
    });

    it('50% 구간은 8일 이하부터 15일 초과 사이다', async () => {
      const [, , qb50] = setupQbs();

      await service.handleDecay();

      expect(qb50.andWhere).toHaveBeenCalledWith('last_active_at <= :cutoff', {
        cutoff: expect.any(Date) as unknown,
      });
      expect(qb50.andWhere).toHaveBeenCalledWith(
        'last_active_at > :previousCutoff',
        { previousCutoff: expect.any(Date) as unknown },
      );
    });

    it('75% 구간은 4일 이하부터 8일 초과 사이다', async () => {
      const [, , , qb75] = setupQbs();

      await service.handleDecay();

      expect(qb75.andWhere).toHaveBeenCalledWith('last_active_at <= :cutoff', {
        cutoff: expect.any(Date) as unknown,
      });
      expect(qb75.andWhere).toHaveBeenCalledWith(
        'last_active_at > :previousCutoff',
        { previousCutoff: expect.any(Date) as unknown },
      );
    });

    it('각 cutoff는 스펙 기준 일수(4/8/15/22일)로 계산된다', async () => {
      const [neutralizeQb, qb25, qb50, qb75] = setupQbs();
      const before = Date.now();

      await service.handleDecay();

      const tolerance = 1000;
      const after = Date.now();
      const cutoff22 = getDateParam(neutralizeQb, 'cutoff');
      const cutoff15 = getDateParam(qb25, 'cutoff');
      const cutoff8 = getDateParam(qb50, 'cutoff');
      const cutoff4 = getDateParam(qb75, 'cutoff');

      expect(
        Math.abs(cutoff22.getTime() - (before - 22 * 86_400_000)),
      ).toBeLessThan(tolerance);
      expect(
        Math.abs(cutoff15.getTime() - (before - 15 * 86_400_000)),
      ).toBeLessThan(tolerance);
      expect(
        Math.abs(cutoff8.getTime() - (before - 8 * 86_400_000)),
      ).toBeLessThan(tolerance);
      expect(
        Math.abs(cutoff4.getTime() - (before - 4 * 86_400_000)),
      ).toBeLessThan(tolerance);
      expect(cutoff22.getTime()).toBeGreaterThanOrEqual(
        after - 22 * 86_400_000 - tolerance,
      );
    });
  });

  describe('반환값 집계', () => {
    it('0% UPDATE affected가 neutralized, 나머지 UPDATE affected 합이 decayed로 반환된다', async () => {
      setupQbs([3, 1, 2, 4]);

      const result = await service.handleDecay();

      expect(result).toEqual({ decayed: 7, neutralized: 3 });
    });

    it('affected가 모두 0이면 decayed 0, neutralized 0을 반환한다', async () => {
      setupQbs();

      const result = await service.handleDecay();

      expect(result).toEqual({ decayed: 0, neutralized: 0 });
    });
  });
});

function getDateParam(qb: QueryBuilderMock, key: string) {
  const call = qb.andWhere.mock.calls.find(([, params]) => {
    return params && Object.prototype.hasOwnProperty.call(params, key);
  });

  if (!call) {
    throw new Error(`Missing ${key} param`);
  }

  const params = call[1];
  const value = params?.[key];

  if (!(value instanceof Date)) {
    throw new Error(`Invalid ${key} param`);
  }

  return value;
}
