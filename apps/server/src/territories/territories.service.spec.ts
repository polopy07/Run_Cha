import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TerritoriesService } from './territories.service';
import { Territory } from './entities/territory.entity';
import { GetTerritoriesDto } from './dto/get-territories.dto';
import { User } from '../users/entities/user.entity';

const BOUNDS: GetTerritoriesDto = {
  minLat: 37.0,
  maxLat: 38.0,
  minLng: 126.0,
  maxLng: 128.0,
};

function makeTerritory(lat: number, lng: number): Territory {
  return {
    id: 1,
    user_id: 1,
    coordinates: [{ lat, lng }],
    area_sqm: 1000,
    occupation_rate: 100,
    center_lat: lat,
    center_lng: lng,
    last_active_at: new Date(),
    user: { id: 1, nickname: 'tester' } as unknown as User,
  };
}

describe('TerritoriesService', () => {
  let service: TerritoriesService;

  const mockQb = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };

  const mockRepo = {
    createQueryBuilder: jest.fn(() => mockQb),
    create: jest.fn((data: Record<string, unknown>) => data),
    save: jest.fn((data: Record<string, unknown>) =>
      Promise.resolve({ id: 1, ...data }),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockQb.getMany.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TerritoriesService,
        { provide: getRepositoryToken(Territory), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<TerritoriesService>(TerritoriesService);
  });

  describe('findInBounds', () => {
    it('center_lat BETWEEN 조건으로 DB에 위임한다', async () => {
      await service.findInBounds(BOUNDS);

      expect(mockQb.where).toHaveBeenCalledWith(
        expect.stringContaining('center_lat BETWEEN'),
        expect.objectContaining({ minLat: 37.0, maxLat: 38.0 }),
      );
    });

    it('center_lng BETWEEN 조건으로 DB에 위임한다', async () => {
      await service.findInBounds(BOUNDS);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('center_lng BETWEEN'),
        expect.objectContaining({ minLng: 126.0, maxLng: 128.0 }),
      );
    });

    it('조회된 영토를 응답 형식으로 매핑해 반환한다', async () => {
      mockQb.getMany.mockResolvedValue([makeTerritory(37.5, 127.0)]);

      const result = await service.findInBounds(BOUNDS);

      expect(result).toEqual([
        {
          id: 1,
          userId: 1,
          coordinates: [{ lat: 37.5, lng: 127.0 }],
          areaSqm: 1000,
          occupationRate: 100,
        },
      ]);
    });

    it('영토가 없으면 빈 배열을 반환한다', async () => {
      const result = await service.findInBounds(BOUNDS);

      expect(result).toEqual([]);
    });
  });

  describe('registerTerritory', () => {
    it('좌표 평균으로 center_lat/center_lng를 계산해 저장한다', async () => {
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
        center_lat: 37.5005,
        center_lng: 127.0,
      });
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('저장된 영토를 반환한다', async () => {
      const saved = { id: 42, user_id: 1, area_sqm: 5000, occupation_rate: 100 };
      mockRepo.save.mockResolvedValue(saved);

      const result = await service.registerTerritory(1, [{ lat: 37.5, lng: 127.0 }], 5000);

      expect(result).toEqual(saved);
    });
  });
});
