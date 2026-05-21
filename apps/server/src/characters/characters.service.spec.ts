import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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

type MockManager = {
  getRepository: jest.Mock;
};

describe('CharactersService', () => {
  let service: CharactersService;
  let userCharactersRepository: ReturnType<typeof mockUserCharactersRepository>;
  let usersRepository: ReturnType<typeof mockUsersRepository>;
  let territoriesRepository: ReturnType<typeof mockUsersRepository>;
  let dataSource: { transaction: jest.Mock };

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
      name: 'defender',
      grade: CharacterGrade.COMMON,
      type: CharacterType.DEFENSE,
    },
  } as UserCharacter;

  beforeEach(async () => {
    const manager: MockManager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === User) return usersRepository;
        if (entity === Territory) return territoriesRepository;
        return userCharactersRepository;
      }),
    };
    dataSource = {
      transaction: jest.fn((callback: (manager: MockManager) => unknown) =>
        callback(manager),
      ),
    };

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
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<CharactersService>(CharactersService);
    userCharactersRepository = module.get(getRepositoryToken(UserCharacter));
    usersRepository = module.get(getRepositoryToken(User));
    territoriesRepository = module.get(getRepositoryToken(Territory));
  });

  it('returns current user characters', async () => {
    userCharactersRepository.find.mockResolvedValue([userCharacter]);

    await expect(service.findMine(1)).resolves.toEqual([
      {
        id: 10,
        characterId: 3,
        name: 'defender',
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
  });

  it('returns deployed state from deployed_territory_id', async () => {
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

  it('upgrades a stat and deducts points in a transaction', async () => {
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
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ points: 50 }),
    );
    expect(userCharactersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ attack_lv: 2 }),
    );
  });

  it('caps upgrade cost', async () => {
    const user = { id: 1, points: 5000 } as User;
    userCharactersRepository.findOne.mockResolvedValue({
      ...userCharacter,
      attack_lv: 29,
      character: {
        ...userCharacter.character,
        grade: CharacterGrade.LEGENDARY,
      },
    });
    usersRepository.findOne.mockResolvedValue(user);
    usersRepository.save.mockResolvedValue(user);
    userCharactersRepository.save.mockResolvedValue(userCharacter);

    await expect(service.upgrade(1, 10, 'attack')).resolves.toEqual({
      id: 10,
      upgradedStat: 'attack',
      newLevel: 30,
      remainingPoints: 0,
    });
  });

  it('deploys defense or buff character to owned territory', async () => {
    const deployTarget = { ...userCharacter };
    const territory = { id: 7, user_id: 1 } as Territory;
    userCharactersRepository.findOne
      .mockResolvedValueOnce(deployTarget)
      .mockResolvedValueOnce(null);
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
      lock: { mode: 'pessimistic_write' },
    });
    expect(userCharactersRepository.findOne).toHaveBeenLastCalledWith({
      where: { user_id: 1, deployed_territory_id: 7 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate deployment to the same territory', async () => {
    userCharactersRepository.findOne
      .mockResolvedValueOnce({ ...userCharacter })
      .mockResolvedValueOnce({ ...userCharacter, id: 99 });
    territoriesRepository.findOne.mockResolvedValue({ id: 7, user_id: 1 });

    await expect(service.deploy(1, 10, 7)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userCharactersRepository.save).not.toHaveBeenCalled();
  });

  it('undeploys by saving deployed_territory_id as null', async () => {
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
  });

  it('rejects attack character deployment', async () => {
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

  it('rejects deployment to another user territory', async () => {
    userCharactersRepository.findOne.mockResolvedValue({ ...userCharacter });
    territoriesRepository.findOne.mockResolvedValue(null);

    await expect(service.deploy(1, 10, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects upgrade for missing user character', async () => {
    userCharactersRepository.findOne.mockResolvedValue(null);

    await expect(service.upgrade(1, 999, 'attack')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects upgrade when points are insufficient', async () => {
    userCharactersRepository.findOne.mockResolvedValue({ ...userCharacter });
    usersRepository.findOne.mockResolvedValue({ id: 1, points: 10 });

    await expect(service.upgrade(1, 10, 'attack')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
