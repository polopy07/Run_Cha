import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CharactersService } from './characters.service';
import { CharacterGrade, CharacterType } from './entities/character.entity';
import { UserCharacter } from './entities/user-character.entity';
import { User } from '../users/entities/user.entity';
import { Territory } from '../territories/entities/territory.entity';

const mockUserCharactersRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
});

const mockUsersRepository = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
});

describe('CharactersService', () => {
  let service: CharactersService;
  let userCharactersRepository: ReturnType<typeof mockUserCharactersRepository>;
  let usersRepository: ReturnType<typeof mockUsersRepository>;
  let territoriesRepository: ReturnType<typeof mockUsersRepository>;

  const userCharacter = {
    id: 10,
    user_id: 1,
    character_id: 3,
    attack_lv: 1,
    defense_lv: 2,
    speed_lv: 3,
    point_lv: 4,
    deployed_territory_id: null,
    character: {
      id: 3,
      name: '수비대',
      grade: CharacterGrade.COMMON,
      type: CharacterType.DEFENSE,
    },
  } as UserCharacter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharactersService,
        {
          provide: getRepositoryToken(UserCharacter),
          useFactory: mockUserCharactersRepository,
        },
        { provide: getRepositoryToken(User), useFactory: mockUsersRepository },
        {
          provide: getRepositoryToken(Territory),
          useFactory: mockUsersRepository,
        },
      ],
    }).compile();

    service = module.get<CharactersService>(CharactersService);
    userCharactersRepository = module.get(getRepositoryToken(UserCharacter));
    usersRepository = module.get(getRepositoryToken(User));
    territoriesRepository = module.get(getRepositoryToken(Territory));
  });

  it('현재 사용자의 보유 캐릭터 목록을 반환한다', async () => {
    userCharactersRepository.find.mockResolvedValue([userCharacter]);

    await expect(service.findMine(1)).resolves.toEqual([
      {
        id: 10,
        characterId: 3,
        name: '수비대',
        grade: CharacterGrade.COMMON,
        type: CharacterType.DEFENSE,
        attackLv: 1,
        defenseLv: 2,
        speedLv: 3,
        pointLv: 4,
        isDeployed: false,
        deployedTerritoryId: null,
      },
    ]);
    expect(userCharactersRepository.find).toHaveBeenCalledWith({
      where: { user_id: 1 },
      relations: { character: true },
      order: { id: 'ASC' },
    });
  });

  it('배치 영토 ID가 있으면 배치 상태와 영토 ID를 함께 반환한다', async () => {
    userCharactersRepository.find.mockResolvedValue([
      {
        ...userCharacter,
        deployed_territory_id: 7,
      },
    ]);

    await expect(service.findMine(1)).resolves.toEqual([
      expect.objectContaining({
        id: 10,
        isDeployed: true,
        deployedTerritoryId: 7,
      }),
    ]);
  });

  it('포인트를 차감하고 지정한 스탯을 강화한다', async () => {
    const user = { id: 1, points: 200 } as User;
    userCharactersRepository.findOne.mockResolvedValue({ ...userCharacter });
    usersRepository.findOne.mockResolvedValue(user);
    usersRepository.save.mockResolvedValue(user);
    userCharactersRepository.save.mockResolvedValue(userCharacter);

    await expect(service.upgrade(1, 10, 'attack')).resolves.toEqual({
      id: 10,
      upgradedStat: 'attack',
      newLevel: 2,
      remainingPoints: 50,
    });
    expect(user.points).toBe(50);
    expect(userCharactersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ attack_lv: 2 }),
    );
  });

  it('수비형 또는 버프형 캐릭터를 사용자 소유 영토에 배치한다', async () => {
    const deployTarget = { ...userCharacter };
    const territory = { id: 7, user_id: 1 } as Territory;
    userCharactersRepository.findOne.mockResolvedValue(deployTarget);
    territoriesRepository.findOne.mockResolvedValue(territory);
    userCharactersRepository.save.mockResolvedValue({
      ...deployTarget,
      deployed_territory_id: 7,
    });

    await expect(service.deploy(1, 10, 7)).resolves.toEqual(
      expect.objectContaining({
        id: 10,
        isDeployed: true,
        deployedTerritoryId: 7,
      }),
    );
    expect(territoriesRepository.findOne).toHaveBeenCalledWith({
      where: { id: 7, user_id: 1 },
    });
    expect(userCharactersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ deployed_territory_id: 7 }),
    );
  });

  it('배치 해제 요청은 deployed_territory_id를 null로 저장한다', async () => {
    const deployedCharacter = {
      ...userCharacter,
      deployed_territory_id: 7,
    };
    userCharactersRepository.findOne.mockResolvedValue(deployedCharacter);
    userCharactersRepository.save.mockResolvedValue({
      ...deployedCharacter,
      deployed_territory_id: null,
    });

    await expect(service.deploy(1, 10, null)).resolves.toEqual(
      expect.objectContaining({
        isDeployed: false,
        deployedTerritoryId: null,
      }),
    );
    expect(territoriesRepository.findOne).not.toHaveBeenCalled();
    expect(userCharactersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ deployed_territory_id: null }),
    );
  });

  it('공격형 캐릭터는 영토에 배치할 수 없다', async () => {
    userCharactersRepository.findOne.mockResolvedValue({
      ...userCharacter,
      character: {
        ...userCharacter.character,
        type: CharacterType.ATTACK,
      },
    });

    await expect(service.deploy(1, 10, 7)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(territoriesRepository.findOne).not.toHaveBeenCalled();
  });

  it('사용자 소유가 아닌 영토에는 배치할 수 없다', async () => {
    userCharactersRepository.findOne.mockResolvedValue({ ...userCharacter });
    territoriesRepository.findOne.mockResolvedValue(null);

    await expect(service.deploy(1, 10, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('보유하지 않은 캐릭터는 강화할 수 없다', async () => {
    userCharactersRepository.findOne.mockResolvedValue(null);

    await expect(service.upgrade(1, 999, 'attack')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('포인트가 부족하면 강화할 수 없다', async () => {
    userCharactersRepository.findOne.mockResolvedValue({ ...userCharacter });
    usersRepository.findOne.mockResolvedValue({ id: 1, points: 10 });

    await expect(service.upgrade(1, 10, 'attack')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
