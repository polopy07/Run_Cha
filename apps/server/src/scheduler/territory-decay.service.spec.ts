import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TerritoryDecayService } from './territory-decay.service';
import { Territory } from '../territories/entities/territory.entity';

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function makeTerritory(id: number, occupation_rate: number, daysInactive: number): Territory {
  return {
    id,
    user_id: 1,
    coordinates: [{ lat: 37.5, lng: 127.0 }],
    area_sqm: 1000,
    occupation_rate,
    last_active_at: daysAgo(daysInactive),
  } as Territory;
}

describe('TerritoryDecayService', () => {
  let service: TerritoryDecayService;

  const mockQb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };

  const mockRepo = {
    find: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(() => mockQb),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TerritoryDecayService,
        { provide: getRepositoryToken(Territory), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<TerritoryDecayService>(TerritoryDecayService);
  });

  describe('점령력 감소 규칙 (기획서 4.3절)', () => {
    it('1~3일: 변화 없음 (100% 유지)', async () => {
      mockRepo.find.mockResolvedValue([makeTerritory(1, 100, 2)]);

      const result = await service.handleDecay();

      expect(mockQb.execute).not.toHaveBeenCalled();
      expect(mockRepo.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ decayed: 0, neutralized: 0 });
    });

    it('4~7일: 100% → 75%로 감소', async () => {
      mockRepo.find.mockResolvedValue([makeTerritory(1, 100, 5)]);

      const result = await service.handleDecay();

      expect(mockQb.set).toHaveBeenCalledWith(
        expect.objectContaining({ occupation_rate: 75 }),
      );
      expect(mockRepo.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ decayed: 1, neutralized: 0 });
    });

    it('8~14일: 100% → 50%로 감소', async () => {
      mockRepo.find.mockResolvedValue([makeTerritory(1, 100, 10)]);

      const result = await service.handleDecay();

      expect(mockQb.set).toHaveBeenCalledWith(
        expect.objectContaining({ occupation_rate: 50 }),
      );
      expect(result).toEqual({ decayed: 1, neutralized: 0 });
    });

    it('15~21일: 100% → 25%로 감소', async () => {
      mockRepo.find.mockResolvedValue([makeTerritory(1, 100, 18)]);

      const result = await service.handleDecay();

      expect(mockQb.set).toHaveBeenCalledWith(
        expect.objectContaining({ occupation_rate: 25 }),
      );
      expect(result).toEqual({ decayed: 1, neutralized: 0 });
    });

    it('22일 이상: 중립화(삭제)', async () => {
      mockRepo.find.mockResolvedValue([makeTerritory(1, 100, 22)]);

      const result = await service.handleDecay();

      expect(mockRepo.delete).toHaveBeenCalledWith(1);
      expect(mockQb.execute).not.toHaveBeenCalled();
      expect(result).toEqual({ decayed: 0, neutralized: 1 });
    });
  });

  describe('이미 감소된 영토 처리', () => {
    it('현재 rate가 이미 목표값과 같으면 업데이트하지 않는다', async () => {
      mockRepo.find.mockResolvedValue([makeTerritory(1, 75, 5)]);

      const result = await service.handleDecay();

      expect(mockQb.execute).not.toHaveBeenCalled();
      expect(mockRepo.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ decayed: 0, neutralized: 0 });
    });

    it('현재 rate가 목표값보다 높을 때만 업데이트한다', async () => {
      mockRepo.find.mockResolvedValue([makeTerritory(1, 100, 7)]);

      const result = await service.handleDecay();

      expect(mockQb.set).toHaveBeenCalledWith(
        expect.objectContaining({ occupation_rate: 75 }),
      );
      expect(result).toEqual({ decayed: 1, neutralized: 0 });
    });
  });

  describe('ON UPDATE CURRENT_TIMESTAMP 방지', () => {
    it('업데이트 시 last_active_at을 함수로 전달해 자동 갱신을 막는다', async () => {
      mockRepo.find.mockResolvedValue([makeTerritory(1, 100, 5)]);

      await service.handleDecay();

      expect(mockQb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          last_active_at: expect.any(Function),
        }),
      );
    });
  });

  describe('여러 영토 복합 처리', () => {
    it('감소/유지/중립화가 섞인 경우 각각 올바르게 처리한다', async () => {
      mockRepo.find.mockResolvedValue([
        makeTerritory(1, 100, 2),   // 유지
        makeTerritory(2, 100, 5),   // 75%로 감소
        makeTerritory(3, 75, 10),   // 50%로 감소
        makeTerritory(4, 100, 25),  // 중립화(삭제)
      ]);

      const result = await service.handleDecay();

      expect(mockQb.execute).toHaveBeenCalledTimes(2);
      expect(mockRepo.delete).toHaveBeenCalledTimes(1);
      expect(mockRepo.delete).toHaveBeenCalledWith(4);
      expect(result).toEqual({ decayed: 2, neutralized: 1 });
    });

    it('영토가 없으면 아무것도 처리하지 않는다', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.handleDecay();

      expect(mockQb.execute).not.toHaveBeenCalled();
      expect(mockRepo.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ decayed: 0, neutralized: 0 });
    });
  });
});
