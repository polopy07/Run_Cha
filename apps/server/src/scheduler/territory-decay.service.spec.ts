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
      .mockReturnValueOnce(qbs[0]) // delete  (21일 초과)
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
        expect.objectContaining({ occupation_rate: 25, last_active_at: expect.any(Function) as unknown }),
      );
      expect(qb50.set).toHaveBeenCalledWith(
        expect.objectContaining({ occupation_rate: 50, last_active_at: expect.any(Function) as unknown }),
      );
      expect(qb75.set).toHaveBeenCalledWith(
        expect.objectContaining({ occupation_rate: 75, last_active_at: expect.any(Function) as unknown }),
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
