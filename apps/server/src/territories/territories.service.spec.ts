import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TerritoriesService } from './territories.service';
import { Territory } from './entities/territory.entity';
import { GetTerritoriesDto } from './dto/get-territories.dto';
import { User } from '../users/entities/user.entity';

const BOUNDS: GetTerritoriesDto = { minLat: 37.0, maxLat: 38.0, minLng: 126.0, maxLng: 128.0 };

function makeTerritory(lat: number, lng: number): Territory {
  return {
    id: 1,
    user_id: 1,
    coordinates: [{ lat, lng }],
    area_sqm: 1000,
    occupation_rate: 100,
    last_active_at: new Date(),
    user: { id: 1, nickname: 'tester' } as unknown as User,
  };
}

describe('TerritoriesService', () => {
  let service: TerritoriesService;

  const mockRepo = {
    find: jest.fn(),
    create: jest.fn((data: Record<string, unknown>) => data),
    save: jest.fn((data: Record<string, unknown>) => Promise.resolve({ id: 1, ...data })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TerritoriesService,
        { provide: getRepositoryToken(Territory), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<TerritoriesService>(TerritoriesService);
  });

  describe('findInBounds', () => {
    it('바운딩 박스 안의 영토를 반환한다', async () => {
      mockRepo.find.mockResolvedValue([
        makeTerritory(37.5, 127.0),
        makeTerritory(36.0, 127.0), // minLat 미만
        makeTerritory(37.5, 128.5), // maxLng 초과
      ]);

      const result = await service.findInBounds(BOUNDS);

      expect(result).toHaveLength(1);
      expect(result[0].coordinates[0]).toEqual({ lat: 37.5, lng: 127.0 });
    });

    it('경계값(minLat, maxLat, minLng, maxLng)의 영토를 포함한다', async () => {
      mockRepo.find.mockResolvedValue([
        makeTerritory(37.0, 126.0), // minLat, minLng 정확히 경계
        makeTerritory(38.0, 128.0), // maxLat, maxLng 정확히 경계
      ]);

      const result = await service.findInBounds(BOUNDS);

      expect(result).toHaveLength(2);
    });

    it('coordinates가 빈 배열인 영토를 제외한다', async () => {
      mockRepo.find.mockResolvedValue([
        { ...makeTerritory(37.5, 127.0), coordinates: [] },
      ]);

      const result = await service.findInBounds(BOUNDS);

      expect(result).toHaveLength(0);
    });

    it('coordinates가 null인 영토를 제외한다', async () => {
      mockRepo.find.mockResolvedValue([
        { ...makeTerritory(37.5, 127.0), coordinates: null },
      ]);

      const result = await service.findInBounds(BOUNDS);

      expect(result).toHaveLength(0);
    });

    it('영토가 없으면 빈 배열을 반환한다', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.findInBounds(BOUNDS);

      expect(result).toEqual([]);
    });

    it('user 관계와 필요한 필드만 조회한다', async () => {
      mockRepo.find.mockResolvedValue([]);
      await service.findInBounds(BOUNDS);

      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user'],
          select: expect.objectContaining({ id: true, user_id: true }) as unknown,
        }),
      );
    });
  });

  describe('registerTerritory', () => {
    it('올바른 데이터로 영토를 생성하고 저장한다', async () => {
      const coords = [
        { lat: 37.5, lng: 127.0 },
        { lat: 37.501, lng: 127.0 },
      ];

      await service.registerTerritory(1, coords, 5000);

      expect(mockRepo.create).toHaveBeenCalledWith({
        user_id: 1,
        coordinates: coords,
        area_sqm: 5000,
        occupation_rate: 100,
      });
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('저장된 영토를 반환한다', async () => {
      const saved = { id: 42, user_id: 1, area_sqm: 5000, occupation_rate: 100 };
      mockRepo.save.mockResolvedValue(saved);

      const result = await service.registerTerritory(1, [], 5000);

      expect(result).toEqual(saved);
    });
  });
});
