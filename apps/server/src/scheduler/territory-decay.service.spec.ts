import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TerritoryDecayService } from './territory-decay.service';
import { Territory } from '../territories/entities/territory.entity';
import {
  DEFENSE_DECAY_GRACE_LEVEL_STEP,
  MAX_DEFENSE_DECAY_GRACE_DAYS,
} from './territory-decay.constants';

type QueryParams = Record<string, unknown>;

type QueryBuilderMock = {
  update: jest.Mock<QueryBuilderMock, []>;
  set: jest.Mock<QueryBuilderMock, [Record<string, unknown>]>;
  where: jest.Mock<QueryBuilderMock, [string, QueryParams?]>;
  andWhere: jest.Mock<QueryBuilderMock, [string, QueryParams?]>;
  setParameters: jest.Mock<QueryBuilderMock, [QueryParams]>;
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
  qb.setParameters = jest.fn<QueryBuilderMock, [QueryParams]>(() => qb);
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

      expectBoundaryCondition(neutralizeQb, '<=', 'inactiveDays');
      expect(neutralizeQb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('previousInactiveDays'),
        expect.any(Object),
      );
    });

    it('25% 구간은 15일 이하부터 22일 초과 사이다', async () => {
      const [, qb25] = setupQbs();

      await service.handleDecay();

      expectBoundaryCondition(qb25, '<=', 'inactiveDays');
      expectBoundaryCondition(qb25, '>', 'previousInactiveDays');
    });

    it('50% 구간은 8일 이하부터 15일 초과 사이다', async () => {
      const [, , qb50] = setupQbs();

      await service.handleDecay();

      expectBoundaryCondition(qb50, '<=', 'inactiveDays');
      expectBoundaryCondition(qb50, '>', 'previousInactiveDays');
    });

    it('75% 구간은 4일 이하부터 8일 초과 사이다', async () => {
      const [, , , qb75] = setupQbs();

      await service.handleDecay();

      expectBoundaryCondition(qb75, '<=', 'inactiveDays');
      expectBoundaryCondition(qb75, '>', 'previousInactiveDays');
    });

    it('각 구간은 스펙 기준 일수(4/8/15/22일)를 파라미터로 사용한다', async () => {
      const [neutralizeQb, qb25, qb50, qb75] = setupQbs();

      await service.handleDecay();

      expect(getParam(neutralizeQb, 'inactiveDays')).toBe(22);
      expect(getParam(qb25, 'inactiveDays')).toBe(15);
      expect(getParam(qb50, 'inactiveDays')).toBe(8);
      expect(getParam(qb75, 'inactiveDays')).toBe(4);
      expect(getParam(qb25, 'previousInactiveDays')).toBe(22);
      expect(getParam(qb50, 'previousInactiveDays')).toBe(15);
      expect(getParam(qb75, 'previousInactiveDays')).toBe(8);
    });

    it('수비형 캐릭터 방어 레벨에 따른 자연 감소 유예 파라미터를 포함한다', async () => {
      const [neutralizeQb, qb25, qb50, qb75] = setupQbs();

      await service.handleDecay();

      for (const qb of [neutralizeQb, qb25, qb50, qb75]) {
        expect(qb.andWhere).toHaveBeenCalledWith(
          expect.stringContaining('user_characters uc'),
          expect.any(Object) as QueryParams,
        );
        expect(qb.andWhere).toHaveBeenCalledWith(
          expect.stringContaining("c.type = 'defense'"),
          expect.any(Object) as QueryParams,
        );
        expect(qb.setParameters).toHaveBeenCalledWith(
          expect.objectContaining({
            now: expect.any(Date) as unknown,
            defenseDecayGraceLevelStep: DEFENSE_DECAY_GRACE_LEVEL_STEP,
            maxDefenseDecayGraceDays: MAX_DEFENSE_DECAY_GRACE_DAYS,
          }) as QueryParams,
        );
      }
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

function getParam(qb: QueryBuilderMock, key: string) {
  const call = qb.andWhere.mock.calls.find(([, params]) => {
    return params && Object.prototype.hasOwnProperty.call(params, key);
  });

  if (!call) {
    throw new Error(`Missing ${key} param`);
  }

  const params = call[1];
  return params?.[key];
}

function expectBoundaryCondition(
  qb: QueryBuilderMock,
  operator: '<=' | '>',
  daysParam: 'inactiveDays' | 'previousInactiveDays',
) {
  expect(qb.andWhere).toHaveBeenCalledWith(
    expect.stringContaining(`last_active_at ${operator}`),
    expect.objectContaining({
      [daysParam]: expect.any(Number) as unknown,
    }) as QueryParams,
  );
}
