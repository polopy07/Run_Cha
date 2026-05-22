import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TerritoryDecayService } from './territory-decay.service';
import { Territory } from '../territories/entities/territory.entity';

function makeQb() {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['delete', 'update', 'set', 'where']) {
    qb[m] = jest.fn().mockReturnValue(qb);
  }
  qb['execute'] = jest.fn().mockResolvedValue({ affected: 0 });
  return qb;
}

describe('TerritoryDecayService', () => {
  let service: TerritoryDecayService;
  let mockRepo: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    mockRepo = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TerritoryDecayService,
        { provide: getRepositoryToken(Territory), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<TerritoryDecayService>(TerritoryDecayService);
  });

  function setupQbs(affected = [0, 0, 0, 0]) {
    const qbs = [makeQb(), makeQb(), makeQb(), makeQb()];
    qbs.forEach((qb, i) => {
      qb['execute'].mockResolvedValue({ affected: affected[i] });
    });
    mockRepo.createQueryBuilder
      .mockReturnValueOnce(qbs[0]) // delete  (22일 초과)
      .mockReturnValueOnce(qbs[1]) // update 25%
      .mockReturnValueOnce(qbs[2]) // update 50%
      .mockReturnValueOnce(qbs[3]); // update 75%
    return qbs;
  }

  describe('배치 쿼리 구조', () => {
    it('DELETE 1개 + UPDATE 3개 총 4개 쿼리를 발행한다', async () => {
      const [deleteQb, qb25, qb50, qb75] = setupQbs();

      await service.handleDecay();

      expect(deleteQb.delete).toHaveBeenCalled();
      expect(qb25.update).toHaveBeenCalled();
      expect(qb50.update).toHaveBeenCalled();
      expect(qb75.update).toHaveBeenCalled();
    });

    it('각 UPDATE는 해당 occupation_rate와 last_active_at 보존으로 SET을 호출한다', async () => {
      const [, qb25, qb50, qb75] = setupQbs();

      await service.handleDecay();

      expect(qb25.set).toHaveBeenCalledWith(
        expect.objectContaining({
          occupation_rate: 25,
          last_active_at: expect.any(Function) as unknown,
        }),
      );
      expect(qb50.set).toHaveBeenCalledWith(
        expect.objectContaining({
          occupation_rate: 50,
          last_active_at: expect.any(Function) as unknown,
        }),
      );
      expect(qb75.set).toHaveBeenCalledWith(
        expect.objectContaining({
          occupation_rate: 75,
          last_active_at: expect.any(Function) as unknown,
        }),
      );
    });

    it('각 UPDATE WHERE 조건은 현재 occupation_rate 하한을 포함한다', async () => {
      const [, qb25, qb50, qb75] = setupQbs();

      await service.handleDecay();

      expect(qb25.where).toHaveBeenCalledWith(
        expect.stringContaining('occupation_rate > 25'),
        expect.any(Object),
      );
      expect(qb50.where).toHaveBeenCalledWith(
        expect.stringContaining('occupation_rate > 50'),
        expect.any(Object),
      );
      expect(qb75.where).toHaveBeenCalledWith(
        expect.stringContaining('occupation_rate > 75'),
        expect.any(Object),
      );
    });
  });

  describe('경계값 조건', () => {
    it('DELETE는 22일 기준(cutoff22)으로 삭제한다', async () => {
      const [deleteQb] = setupQbs();
      await service.handleDecay();
      expect(deleteQb.where).toHaveBeenCalledWith(
        expect.stringContaining('last_active_at <= :cutoff22'),
        expect.objectContaining({ cutoff22: expect.any(Date) as unknown }),
      );
    });

    it('25% 구간은 15일(cutoff15) 이하 ~ 22일(cutoff22) 초과 사이다', async () => {
      const [, qb25] = setupQbs();
      await service.handleDecay();
      expect(qb25.where).toHaveBeenCalledWith(
        expect.stringMatching(
          /last_active_at <= :cutoff15.*last_active_at > :cutoff22/,
        ),
        expect.objectContaining({
          cutoff15: expect.any(Date) as unknown,
          cutoff22: expect.any(Date) as unknown,
        }),
      );
    });

    it('50% 구간은 8일(cutoff8) 이하 ~ 15일(cutoff15) 초과 사이다', async () => {
      const [, , qb50] = setupQbs();
      await service.handleDecay();
      expect(qb50.where).toHaveBeenCalledWith(
        expect.stringMatching(
          /last_active_at <= :cutoff8.*last_active_at > :cutoff15/,
        ),
        expect.objectContaining({
          cutoff8: expect.any(Date) as unknown,
          cutoff15: expect.any(Date) as unknown,
        }),
      );
    });

    it('75% 구간은 4일(cutoff4) 이하 ~ 8일(cutoff8) 초과 사이다', async () => {
      const [, , , qb75] = setupQbs();
      await service.handleDecay();
      expect(qb75.where).toHaveBeenCalledWith(
        expect.stringMatching(
          /last_active_at <= :cutoff4.*last_active_at > :cutoff8/,
        ),
        expect.objectContaining({
          cutoff4: expect.any(Date) as unknown,
          cutoff8: expect.any(Date) as unknown,
        }),
      );
    });

    it('각 cutoff는 스펙 기준 일수(4/8/15/22일)로 계산된다', async () => {
      const [deleteQb, qb25, qb50, qb75] = setupQbs();
      const before = Date.now();
      await service.handleDecay();
      const after = Date.now();
      const tolerance = 1000;

      const [, { cutoff22 }] = deleteQb.where.mock.calls[0] as [
        string,
        { cutoff22: Date },
      ];
      const [, { cutoff15 }] = qb25.where.mock.calls[0] as [
        string,
        { cutoff15: Date },
      ];
      const [, { cutoff8 }] = qb50.where.mock.calls[0] as [
        string,
        { cutoff8: Date },
      ];
      const [, { cutoff4 }] = qb75.where.mock.calls[0] as [
        string,
        { cutoff4: Date },
      ];

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
      // after 기준으로도 범위 이내
      expect(cutoff22.getTime()).toBeGreaterThanOrEqual(
        after - 22 * 86_400_000 - tolerance,
      );
    });
  });

  describe('반환값 집계', () => {
    it('UPDATE 3개의 affected 합이 decayed, DELETE affected가 neutralized로 반환된다', async () => {
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
