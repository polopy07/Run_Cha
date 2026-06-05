import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  Character,
  CharacterGrade,
  CharacterType,
} from '../characters/entities/character.entity';
import { UserCharacter } from '../characters/entities/user-character.entity';
import { User } from '../users/entities/user.entity';
import { GachaLog } from './entities/gacha-log.entity';
import { GachaService } from './gacha.service';

const mockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
  save: jest.fn((value: unknown) => Promise.resolve(value)),
  insert: jest.fn((value: unknown) => Promise.resolve(value)),
});

type MockManager = {
  getRepository: jest.Mock;
};

describe('GachaService', () => {
  let service: GachaService;
  let charactersRepository: ReturnType<typeof mockRepository>;
  let userCharactersRepository: ReturnType<typeof mockRepository>;
  let gachaLogsRepository: ReturnType<typeof mockRepository>;
  let usersRepository: ReturnType<typeof mockRepository>;
  let dataSource: { transaction: jest.Mock };

  const characters = [
    {
      id: 1,
      name: 'Attack Common',
      grade: CharacterGrade.COMMON,
      type: CharacterType.ATTACK,
    },
    {
      id: 2,
      name: 'Defense Rare',
      grade: CharacterGrade.RARE,
      type: CharacterType.DEFENSE,
    },
    {
      id: 3,
      name: 'Buff Epic',
      grade: CharacterGrade.EPIC,
      type: CharacterType.BUFF,
    },
    {
      id: 4,
      name: 'Attack Legendary',
      grade: CharacterGrade.LEGENDARY,
      type: CharacterType.ATTACK,
    },
  ] as Character[];

  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    charactersRepository = mockRepository();
    userCharactersRepository = mockRepository();
    gachaLogsRepository = mockRepository();
    usersRepository = mockRepository();
    const manager: MockManager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === User) return usersRepository;
        if (entity === UserCharacter) return userCharactersRepository;
        if (entity === GachaLog) return gachaLogsRepository;
        return charactersRepository;
      }),
    };
    dataSource = {
      transaction: jest.fn((callback: (manager: MockManager) => unknown) =>
        callback(manager),
      ),
    };

    service = new GachaService(
      charactersRepository as unknown as Repository<Character>,
      dataSource as unknown as DataSource,
    );

    charactersRepository.find.mockResolvedValue(characters);
    userCharactersRepository.find.mockResolvedValue([]);
    userCharactersRepository.count.mockResolvedValue(0);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('deducts draw cost and returns a 1-draw result', async () => {
    const user = { id: 1, points: 500 } as User;
    usersRepository.findOne.mockResolvedValue(user);

    await expect(service.draw(1, 1)).resolves.toEqual({
      results: [
        {
          characterId: 1,
          name: 'Attack Common',
          grade: CharacterGrade.COMMON,
          type: CharacterType.ATTACK,
          isNew: true,
        },
      ],
      remainingPoints: 400,
    });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(userCharactersRepository.insert).toHaveBeenCalledWith([
      {
        user_id: 1,
        character_id: 1,
      },
    ]);
    expect(gachaLogsRepository.insert).toHaveBeenCalledWith([
      {
        user_id: 1,
        result_character_id: 1,
      },
    ]);
    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ points: 400 }),
    );
    const characterIdMatcher: unknown = expect.any(Object);
    expect(userCharactersRepository.find).toHaveBeenCalledWith({
      where: { user_id: 1, character_id: characterIdMatcher },
      select: { character_id: true },
    });
    expect(charactersRepository.find).toHaveBeenCalledWith({
      select: {
        id: true,
        name: true,
        grade: true,
        type: true,
      },
    });
  });

  it('reuses the cached character master pool by grade', async () => {
    usersRepository.findOne
      .mockResolvedValueOnce({ id: 1, points: 500 })
      .mockResolvedValueOnce({ id: 1, points: 500 });

    await service.draw(1, 1);
    await service.draw(1, 1);

    expect(charactersRepository.find).toHaveBeenCalledTimes(1);
  });

  it('reloads the character master pool after cache TTL expires', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    usersRepository.findOne
      .mockResolvedValueOnce({ id: 1, points: 500 })
      .mockResolvedValueOnce({ id: 1, points: 500 });

    await service.draw(1, 1);
    jest.advanceTimersByTime(5 * 60 * 1000 + 1);
    await service.draw(1, 1);

    expect(charactersRepository.find).toHaveBeenCalledTimes(2);
  });

  it('uses the stale character cache when refresh fails after TTL expires', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    usersRepository.findOne
      .mockResolvedValueOnce({ id: 1, points: 500 })
      .mockResolvedValueOnce({ id: 1, points: 500 });

    await service.draw(1, 1);
    jest.advanceTimersByTime(5 * 60 * 1000 + 1);
    charactersRepository.find.mockRejectedValueOnce(new Error('db down'));

    await expect(service.draw(1, 1)).resolves.toEqual(
      expect.objectContaining({
        results: [
          expect.objectContaining({
            characterId: 1,
            grade: CharacterGrade.COMMON,
          }),
        ],
      }),
    );
    expect(charactersRepository.find).toHaveBeenCalledTimes(2);
  });

  it('batch inserts user characters and gacha logs for 10 draws', async () => {
    const user = { id: 1, points: 1000 } as User;
    usersRepository.findOne.mockResolvedValue(user);

    const result = await service.draw(1, 10);

    expect(result.remainingPoints).toBe(100);
    expect(result.results).toHaveLength(10);
    expect(result.results[0]).toEqual(expect.objectContaining({ isNew: true }));
    expect(result.results[1]).toEqual(
      expect.objectContaining({ isNew: false }),
    );
    expect(userCharactersRepository.insert).toHaveBeenCalledTimes(1);
    expect(gachaLogsRepository.insert).toHaveBeenCalledTimes(1);
    expect(userCharactersRepository.insert.mock.calls[0][0]).toHaveLength(10);
    expect(gachaLogsRepository.insert.mock.calls[0][0]).toHaveLength(10);
    expect(gachaLogsRepository.insert.mock.calls[0][0]).toEqual(
      Array.from({ length: 10 }, () => ({
        user_id: 1,
        result_character_id: 1,
      })),
    );
  });

  it('uses random grade selection without legacy pity guarantee override', async () => {
    const user = { id: 1, points: 500 } as User;
    usersRepository.findOne.mockResolvedValue(user);
    (Math.random as jest.Mock).mockReturnValueOnce(0.2).mockReturnValueOnce(0);

    const result = await service.draw(1, 1);

    expect(result.results[0]).toEqual(
      expect.objectContaining({
        characterId: 1,
        grade: CharacterGrade.COMMON,
      }),
    );
    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ points: 400 }),
    );
    expect(gachaLogsRepository.insert).toHaveBeenCalledWith([
      {
        user_id: 1,
        result_character_id: 1,
      },
    ]);
  });

  it('does not draw when points are insufficient', async () => {
    usersRepository.findOne.mockResolvedValue({
      id: 1,
      points: 50,
    });

    await expect(service.draw(1, 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userCharactersRepository.insert).not.toHaveBeenCalled();
    expect(gachaLogsRepository.insert).not.toHaveBeenCalled();
  });

  it('rejects 1 draw when character storage is full', async () => {
    usersRepository.findOne.mockResolvedValue({
      id: 1,
      points: 500,
    });
    userCharactersRepository.count.mockResolvedValue(30);

    await expect(service.draw(1, 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userCharactersRepository.insert).not.toHaveBeenCalled();
    expect(gachaLogsRepository.insert).not.toHaveBeenCalled();
  });

  it('rejects 10 draws when character storage would exceed the limit', async () => {
    usersRepository.findOne.mockResolvedValue({
      id: 1,
      points: 1000,
    });
    userCharactersRepository.count.mockResolvedValue(25);

    await expect(service.draw(1, 10)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(userCharactersRepository.insert).not.toHaveBeenCalled();
    expect(gachaLogsRepository.insert).not.toHaveBeenCalled();
  });

  it('throws a server setup error when no drawable characters exist', async () => {
    charactersRepository.find.mockResolvedValue([]);

    await expect(service.draw(1, 1)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('throws a server setup error when a grade has no drawable characters', async () => {
    charactersRepository.find.mockResolvedValue(
      characters.filter(
        (character) => character.grade !== CharacterGrade.LEGENDARY,
      ),
    );

    await expect(service.draw(1, 1)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
