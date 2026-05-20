import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  Character,
  CharacterGrade,
  CharacterType,
} from '../characters/entities/character.entity';
import { User } from '../users/entities/user.entity';
import { GachaService } from './gacha.service';

const mockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((value: unknown) => value),
  save: jest.fn((value: unknown) => Promise.resolve(value)),
});

describe('GachaService', () => {
  let service: GachaService;
  let charactersRepository: ReturnType<typeof mockRepository>;
  let userCharactersRepository: ReturnType<typeof mockRepository>;
  let gachaLogsRepository: ReturnType<typeof mockRepository>;
  let usersRepository: ReturnType<typeof mockRepository>;

  const characters = [
    {
      id: 1,
      name: '방랑자',
      grade: CharacterGrade.COMMON,
      type: CharacterType.TERRITORY,
    },
    {
      id: 2,
      name: '탐험가',
      grade: CharacterGrade.RARE,
      type: CharacterType.TERRITORY,
    },
    {
      id: 3,
      name: '정복자',
      grade: CharacterGrade.EPIC,
      type: CharacterType.TERRITORY,
    },
    {
      id: 4,
      name: '군주',
      grade: CharacterGrade.LEGENDARY,
      type: CharacterType.TERRITORY,
    },
  ] as Character[];

  beforeEach(() => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    charactersRepository = mockRepository();
    userCharactersRepository = mockRepository();
    gachaLogsRepository = mockRepository();
    usersRepository = mockRepository();

    service = new GachaService(
      charactersRepository,
      userCharactersRepository,
      gachaLogsRepository,
      usersRepository,
    );

    charactersRepository.find.mockResolvedValue(characters);
    userCharactersRepository.find.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1회 뽑기 비용을 차감하고 결과를 반환한다', async () => {
    const user = { id: 1, points: 500, pity_count: 0 } as User;
    usersRepository.findOne.mockResolvedValue(user);

    await expect(service.draw(1, 1)).resolves.toEqual({
      results: [
        {
          characterId: 1,
          name: '방랑자',
          grade: CharacterGrade.COMMON,
          type: CharacterType.TERRITORY,
          isNew: true,
          isGuaranteed: false,
        },
      ],
      remainingPoints: 400,
    });
    expect(user.points).toBe(400);
    expect(user.pity_count).toBe(1);
    expect(userCharactersRepository.save).toHaveBeenCalledWith({
      user_id: 1,
      character_id: 1,
    });
    expect(gachaLogsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 1,
        result_character_id: 1,
        is_guaranteed: false,
        pity_count: 1,
      }),
    );
  });

  it('10회 뽑기 비용은 900포인트다', async () => {
    const user = { id: 1, points: 1000, pity_count: 0 } as User;
    usersRepository.findOne.mockResolvedValue(user);

    const result = await service.draw(1, 10);

    expect(result.remainingPoints).toBe(100);
    expect(result.results).toHaveLength(10);
  });

  it('천장 조건이면 전설 캐릭터를 확정 지급하고 pityCount를 초기화한다', async () => {
    const user = { id: 1, points: 500, pity_count: 99 } as User;
    usersRepository.findOne.mockResolvedValue(user);

    const result = await service.draw(1, 1);

    expect(result.results[0]).toEqual(
      expect.objectContaining({
        characterId: 4,
        grade: CharacterGrade.LEGENDARY,
        isGuaranteed: true,
      }),
    );
    expect(user.pity_count).toBe(0);
  });

  it('포인트가 부족하면 뽑기를 수행하지 않는다', async () => {
    usersRepository.findOne.mockResolvedValue({
      id: 1,
      points: 50,
      pity_count: 0,
    });

    await expect(service.draw(1, 1)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('뽑기 가능한 캐릭터가 없으면 예외를 반환한다', async () => {
    usersRepository.findOne.mockResolvedValue({
      id: 1,
      points: 500,
      pity_count: 0,
    });
    charactersRepository.find.mockResolvedValue([]);

    await expect(service.draw(1, 1)).rejects.toBeInstanceOf(NotFoundException);
  });
});
