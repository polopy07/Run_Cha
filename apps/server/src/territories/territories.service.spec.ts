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
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQb),
    create: jest.fn((data: Record<string, unknown>) => data),
    save: jest.fn((data: Record<string, unknown>) =>
      Promise.resolve({ id: 1, ...data }),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.find.mockResolvedValue([]);
    mockQb.getMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TerritoriesService,
        { provide: getRepositoryToken(Territory), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<TerritoriesService>(TerritoriesService);
  });

  describe('findMine', () => {
    it('returns territories owned by the current user', async () => {
      const territory = makeTerritory(37.5, 127.0);
      mockRepo.find.mockResolvedValue([territory]);

      const result = await service.findMine(1);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { user_id: 1 },
        order: { id: 'ASC' },
        select: {
          id: true,
          user_id: true,
          coordinates: true,
          area_sqm: true,
          occupation_rate: true,
          last_active_at: true,
        },
      });
      expect(result).toEqual([
        {
          id: territory.id,
          userId: territory.user_id,
          coordinates: territory.coordinates,
          areaSqm: territory.area_sqm,
          occupationRate: territory.occupation_rate,
          lastActiveAt: territory.last_active_at,
        },
      ]);
    });

    it('returns an empty array when the user has no territories', async () => {
      await expect(service.findMine(1)).resolves.toEqual([]);
    });
  });

  describe('findInBounds', () => {
    it('uses center_lat BETWEEN condition for DB filtering', async () => {
      await service.findInBounds(BOUNDS);

      expect(mockQb.where).toHaveBeenCalledWith(
        expect.stringContaining('center_lat BETWEEN'),
        expect.objectContaining({ minLat: 37.0, maxLat: 38.0 }),
      );
    });

    it('uses center_lng BETWEEN condition for DB filtering', async () => {
      await service.findInBounds(BOUNDS);

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('center_lng BETWEEN'),
        expect.objectContaining({ minLng: 126.0, maxLng: 128.0 }),
      );
    });

    it('maps found territories to response format', async () => {
      const territory = makeTerritory(37.5, 127.0);
      mockQb.getMany.mockResolvedValue([territory]);

      const result = await service.findInBounds(BOUNDS);

      expect(result).toEqual([
        {
          id: 1,
          coordinates: [{ lat: 37.5, lng: 127.0 }],
          areaSqm: 1000,
          occupationRate: 100,
        },
      ]);
    });

    it('returns an empty array when no territories are found', async () => {
      const result = await service.findInBounds(BOUNDS);

      expect(result).toEqual([]);
    });
  });

  describe('registerTerritory', () => {
    it('calculates and saves center_lat/center_lng from coordinates', async () => {
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

    it('returns saved territory', async () => {
      const saved = {
        id: 42,
        user_id: 1,
        area_sqm: 5000,
        occupation_rate: 100,
      };
      mockRepo.save.mockResolvedValue(saved);

      const result = await service.registerTerritory(
        1,
        [{ lat: 37.5, lng: 127.0 }],
        5000,
      );

      expect(result).toEqual(saved);
    });
  });
});
