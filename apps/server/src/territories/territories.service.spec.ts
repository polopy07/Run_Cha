import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MoreThan } from 'typeorm';
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
    name: null,
    coordinates: [{ lat, lng }],
    area_sqm: 1000,
    occupation_rate: 100,
    center_lat: lat,
    center_lng: lng,
    last_active_at: new Date(),
    protected_until: null,
    user: { id: 1, nickname: 'tester' } as unknown as User,
  };
}

describe('TerritoriesService', () => {
  let service: TerritoriesService;

  const mockQb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoinAndMapMany: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
  };

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQb),
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
    mockRepo.find.mockResolvedValue([]);
    mockRepo.findOne.mockResolvedValue(null);
    mockQb.getMany.mockResolvedValue([]);
    mockQb.getOne.mockResolvedValue(null);
    mockUserCharactersRepo.find.mockResolvedValue([]);

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
        where: {
          user_id: 1,
          area_sqm: MoreThan(0),
          occupation_rate: MoreThan(0),
        },
        order: { id: 'ASC' },
        relations: ['user'],
        select: {
          id: true,
          user_id: true,
          name: true,
          coordinates: true,
          area_sqm: true,
          occupation_rate: true,
          last_active_at: true,
          user: { id: true, nickname: true },
        },
      });
      expect(result).toEqual([
        {
          id: territory.id,
          userId: territory.user_id,
          name: territory.name,
          ownerNickname: territory.user.nickname,
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
    it('joins user with leftJoinAndSelect to populate ownerNickname', async () => {
      await service.findInBounds(BOUNDS);

      expect(mockQb.leftJoinAndSelect).toHaveBeenCalledWith('t.user', 'u');
    });

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

    it('filters out empty or neutralized territories from map bounds', async () => {
      await service.findInBounds(BOUNDS);

      expect(mockQb.andWhere).toHaveBeenCalledWith('t.area_sqm > 0');
      expect(mockQb.andWhere).toHaveBeenCalledWith('t.occupation_rate > 0');
    });

    it('maps ownerNickname from joined user relation', async () => {
      const territory = makeTerritory(37.5, 127.0);
      mockQb.getMany.mockResolvedValue([territory]);

      const result = await service.findInBounds(BOUNDS);

      expect(result).toEqual([
        {
          id: territory.id,
          userId: territory.user_id,
          name: territory.name,
          ownerNickname: territory.user.nickname,
          coordinates: territory.coordinates,
          areaSqm: territory.area_sqm,
          occupationRate: territory.occupation_rate,
        },
      ]);
    });

    it('returns ownerNickname as null when user relation is not loaded', async () => {
      const territory = {
        ...makeTerritory(37.5, 127.0),
        user: null as unknown as User,
      };
      mockQb.getMany.mockResolvedValue([territory]);

      const result = await service.findInBounds(BOUNDS);

      expect(result[0].ownerNickname).toBeNull();
    });

    it('returns an empty array when no territories are found', async () => {
      const result = await service.findInBounds(BOUNDS);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('returns territory detail with owner, mine flag, and deployed characters', async () => {
      const territory = makeTerritory(37.5, 127.0);
      const character = {
        id: 3,
        name: 'defender',
        grade: CharacterGrade.COMMON,
        type: CharacterType.DEFENSE,
        base_point_rate: 1,
      } as Character;
      const userCharacter = {
        id: 10,
        character_id: 3,
        character,
        attack_lv: 1,
        defense_lv: 2,
        point_lv: 3,
      } as UserCharacter;
      mockQb.getOne.mockResolvedValue({
        ...territory,
        deployedCharacters: [userCharacter],
      });

      const result = await service.findOne(1, 1);

      expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('t');
      expect(mockQb.leftJoinAndSelect).toHaveBeenCalledWith('t.user', 'u');
      expect(mockQb.leftJoinAndMapMany).toHaveBeenCalledWith(
        't.deployedCharacters',
        UserCharacter,
        'uc',
        'uc.deployed_territory_id = t.id',
      );
      expect(mockQb.leftJoinAndSelect).toHaveBeenCalledWith(
        'uc.character',
        'c',
      );
      expect(mockQb.where).toHaveBeenCalledWith('t.id = :id', { id: 1 });
      expect(mockQb.andWhere).toHaveBeenCalledWith('t.area_sqm > 0');
      expect(mockQb.andWhere).toHaveBeenCalledWith('t.occupation_rate > 0');
      expect(mockQb.orderBy).toHaveBeenCalledWith('uc.id', 'ASC');
      expect(mockUserCharactersRepo.find).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: territory.id,
        name: territory.name,
        coordinates: territory.coordinates,
        areaSqm: territory.area_sqm,
        occupationRate: territory.occupation_rate,
        lastActiveAt: territory.last_active_at,
        protectedUntil: null,
        owner: { id: 1, nickname: 'tester' },
        isMine: true,
        deployedCharacters: [
          {
            id: 10,
            characterId: 3,
            name: 'defender',
            grade: CharacterGrade.COMMON,
            type: CharacterType.DEFENSE,
            basePointRate: 1,
            attackLv: 1,
            defenseLv: 2,
            pointLv: 3,
          },
        ],
      });
    });

    it('returns isMine false when the current user is not the owner', async () => {
      mockQb.getOne.mockResolvedValue(makeTerritory(37.5, 127.0));

      const result = await service.findOne(1, 2);

      expect(result.isMine).toBe(false);
      expect(result.deployedCharacters).toEqual([]);
    });

    it('returns isMine false for unauthenticated users', async () => {
      mockQb.getOne.mockResolvedValue(makeTerritory(37.5, 127.0));

      const result = await service.findOne(1, null);

      expect(result.isMine).toBe(false);
    });

    it('throws NotFoundException when the territory does not exist', async () => {
      await expect(service.findOne(999, 1)).rejects.toThrow(
        '영토를 찾을 수 없습니다.',
      );
      expect(mockUserCharactersRepo.find).not.toHaveBeenCalled();
    });

    it('guards detail lookup with active territory filters', async () => {
      await expect(service.findOne(1, 1)).rejects.toThrow(
        '영토를 찾을 수 없습니다.',
      );

      expect(mockQb.where).toHaveBeenCalledWith('t.id = :id', { id: 1 });
      expect(mockQb.andWhere).toHaveBeenCalledWith('t.area_sqm > 0');
      expect(mockQb.andWhere).toHaveBeenCalledWith('t.occupation_rate > 0');
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
        name: null,
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
