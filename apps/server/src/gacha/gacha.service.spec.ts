import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
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
      name: '공격형1',
      grade: CharacterGrade.COMMON,
      type: CharacterType.ATTACK,
    },
    {
      id: 2,
      name: '수비형2',
      grade: CharacterGrade.RARE,
      type: CharacterType.DEFENSE,
    },
    {
      id: 3,
      name: '버프형3',
      grade: CharacterGrade.EPIC,
      type: CharacterType.BUFF,
    },
    {
      id: 4,
      name: '공격형4',
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
      charactersRepository,
      dataSource as unknown as DataSource,
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
          name: '공격형1',
          grade: CharacterGrade.COMMON,
          type: CharacterType.ATTACK,
          isNew: true,
          isGuaranteed: false,
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
      expect.objectContaining({
        user_id: 1,
        result_character_id: 1,
        is_guaranteed: false,
        pity_count: 1,
      }),
    ]);
    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ points: 400, pity_count: 1 }),
    );
  });

  it('10회 뽑기는 캐릭터와 로그를 배열 insert로 저장한다', async () => {
    const user = { id: 1, points: 1000, pity_count: 0 } as User;
    usersRepository.findOne.mockResolvedValue(user);

    const result = await service.draw(1, 10);

    expect(result.remainingPoints).toBe(100);
    expect(result.results).toHaveLength(10);
    expect(userCharactersRepository.insert).toHaveBeenCalledTimes(1);
    expect(gachaLogsRepository.insert).toHaveBeenCalledTimes(1);
    expect(userCharactersRepository.insert.mock.calls[0][0]).toHaveLength(10);
    expect(gachaLogsRepository.insert.mock.calls[0][0]).toHaveLength(10);
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
    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ pity_count: 0 }),
    );
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
    expect(userCharactersRepository.insert).not.toHaveBeenCalled();
    expect(gachaLogsRepository.insert).not.toHaveBeenCalled();
  });

  it('뽑기 가능한 캐릭터가 없으면 서버 설정 오류로 처리한다', async () => {
    charactersRepository.find.mockResolvedValue([]);

    await expect(service.draw(1, 1)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
