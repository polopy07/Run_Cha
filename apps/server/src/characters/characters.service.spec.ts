import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CharactersService } from './characters.service';
import { CharacterGrade, CharacterType } from './entities/character.entity';
import { UserCharacter } from './entities/user-character.entity';
import { User } from '../users/entities/user.entity';

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

  const userCharacter = {
    id: 10,
    user_id: 1,
    character_id: 3,
    attack_lv: 1,
    defense_lv: 2,
    speed_lv: 3,
    point_lv: 4,
    is_deployed: false,
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
      ],
    }).compile();

    service = module.get<CharactersService>(CharactersService);
    userCharactersRepository = module.get(getRepositoryToken(UserCharacter));
    usersRepository = module.get(getRepositoryToken(User));
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
