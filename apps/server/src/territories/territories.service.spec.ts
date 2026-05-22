import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TerritoriesService } from './territories.service';
import { Territory } from './entities/territory.entity';
import { GetTerritoriesDto } from './dto/get-territories.dto';
import { User } from '../users/entities/user.entity';
import { UserCharacter } from '../characters/entities/user-character.entity';
import {
  Character,
  CharacterGrade,
  CharacterType,
} from '../characters/entities/character.entity';

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
    last_active_at: new Date(),
    user: { id: 1, nickname: 'tester' } as unknown as User,
  };
}

describe('TerritoriesService', () => {
  let service: TerritoriesService;

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((data: Record<string, unknown>) => data),
    save: jest.fn((data: Record<string, unknown>) =>
      Promise.resolve({ id: 1, ...data }),
    ),
  };
  const mockUserCharactersRepo = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TerritoriesService,
        { provide: getRepositoryToken(Territory), useValue: mockRepo },
        {
          provide: getRepositoryToken(UserCharacter),
          useValue: mockUserCharactersRepo,
        },
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
      mockRepo.find.mockResolvedValue([]);

      await expect(service.findMine(1)).resolves.toEqual([]);
    });
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
          select: expect.objectContaining({
            id: true,
            user_id: true,
          }) as unknown,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns territory detail with owner, mine flag, and deployed characters', async () => {
      const territory = makeTerritory(37.5, 127.0);
      const character = {
        id: 3,
        name: '수비형1',
        grade: CharacterGrade.COMMON,
        type: CharacterType.DEFENSE,
      } as Character;
      const userCharacter = {
        id: 10,
        character_id: 3,
        character,
        attack_lv: 1,
        defense_lv: 2,
        speed_lv: 1,
        point_lv: 1,
      } as UserCharacter;
      mockRepo.findOne.mockResolvedValue(territory);
      mockUserCharactersRepo.find.mockResolvedValue([userCharacter]);

      const result = await service.findOne(1, 1);

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['user'],
        select: {
          id: true,
          user_id: true,
          coordinates: true,
          area_sqm: true,
          occupation_rate: true,
          last_active_at: true,
          user: { id: true, nickname: true },
        },
      });
      expect(mockUserCharactersRepo.find).toHaveBeenCalledWith({
        where: { deployed_territory_id: 1 },
        relations: { character: true },
        order: { id: 'ASC' },
      });
      expect(result).toEqual({
        id: territory.id,
        userId: territory.user_id,
        coordinates: territory.coordinates,
        areaSqm: territory.area_sqm,
        occupationRate: territory.occupation_rate,
        lastActiveAt: territory.last_active_at,
        owner: { id: 1, nickname: 'tester' },
        isMine: true,
        deployedCharacters: [
          {
            id: 10,
            characterId: 3,
            name: '수비형1',
            grade: CharacterGrade.COMMON,
            type: CharacterType.DEFENSE,
            attackLv: 1,
            defenseLv: 2,
            speedLv: 1,
            pointLv: 1,
          },
        ],
      });
    });

    it('returns isMine false when the current user is not the owner', async () => {
      mockRepo.findOne.mockResolvedValue(makeTerritory(37.5, 127.0));
      mockUserCharactersRepo.find.mockResolvedValue([]);

      const result = await service.findOne(1, 2);

      expect(result.isMine).toBe(false);
      expect(result.deployedCharacters).toEqual([]);
    });

    it('throws NotFoundException when the territory does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999, 1)).rejects.toThrow(
        '영토를 찾을 수 없습니다.',
      );
      expect(mockUserCharactersRepo.find).not.toHaveBeenCalled();
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
      const saved = {
        id: 42,
        user_id: 1,
        area_sqm: 5000,
        occupation_rate: 100,
      };
      mockRepo.save.mockResolvedValue(saved);

      const result = await service.registerTerritory(1, [], 5000);

      expect(result).toEqual(saved);
    });
  });
});
