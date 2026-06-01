import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  Character,
  CharacterGrade,
  CharacterType,
} from '../characters/entities/character.entity';
import { UserCharacter } from '../characters/entities/user-character.entity';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const usersRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const charactersRepository = {
    find: jest.fn(),
  };
  const userCharactersRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };
  type MockManager = {
    getRepository: jest.Mock;
  };
  const manager: MockManager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === User) return usersRepository;
      if (entity === Character) return charactersRepository;
      return userCharactersRepository;
    }),
  };
  const dataSource = {
    transaction: jest.fn((callback: (manager: MockManager) => unknown) =>
      callback(manager),
    ),
    query: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: usersRepository,
        },
        {
          provide: getRepositoryToken(Character),
          useValue: charactersRepository,
        },
        {
          provide: getRepositoryToken(UserCharacter),
          useValue: userCharactersRepository,
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('서비스가 정의되어 있어야 한다', () => {
    expect(service).toBeDefined();
  });

  it('기존 Firebase uid 사용자가 있으면 그대로 반환한다', async () => {
    const user = { id: 1, firebase_uid: 'firebase-uid' };
    usersRepository.findOne.mockResolvedValue(user);

    await expect(
      service.findOrCreateUser('firebase-uid', 'test@example.com'),
    ).resolves.toBe(user);
    expect(usersRepository.create).not.toHaveBeenCalled();
    expect(usersRepository.save).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('같은 이메일 사용자가 있으면 Firebase uid를 갱신하고 기존 사용자를 반환한다', async () => {
    const user = {
      id: 1,
      firebase_uid: 'old-firebase-uid',
      email: 'test@example.com',
    };
    usersRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(user);
    usersRepository.save.mockResolvedValue({
      ...user,
      firebase_uid: 'new-firebase-uid',
    });

    await expect(
      service.findOrCreateUser('new-firebase-uid', 'test@example.com'),
    ).resolves.toEqual({
      ...user,
      firebase_uid: 'new-firebase-uid',
    });

    expect(usersRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { firebase_uid: 'new-firebase-uid' },
    });
    expect(usersRepository.findOne).toHaveBeenNthCalledWith(2, {
      where: { email: 'test@example.com' },
    });
    expect(usersRepository.findOne).toHaveBeenNthCalledWith(3, {
      where: { email: 'test@example.com' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(usersRepository.save).toHaveBeenCalledWith({
      ...user,
      firebase_uid: 'new-firebase-uid',
    });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('이메일 기반 UID 갱신 중 이미 다른 요청이 UID를 바꿨으면 덮어쓰지 않는다', async () => {
    const staleUser = {
      id: 1,
      firebase_uid: 'old-firebase-uid',
      email: 'test@example.com',
    };
    const updatedUser = {
      ...staleUser,
      firebase_uid: 'other-firebase-uid',
    };
    usersRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(staleUser)
      .mockResolvedValueOnce(updatedUser);

    await expect(
      service.findOrCreateUser('new-firebase-uid', 'test@example.com'),
    ).resolves.toEqual(updatedUser);

    expect(usersRepository.findOne).toHaveBeenNthCalledWith(3, {
      where: { email: 'test@example.com' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(usersRepository.save).not.toHaveBeenCalled();
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('기존 사용자가 없으면 이메일 앞부분을 기본 닉네임으로 생성한다', async () => {
    const createdUser = {
      firebase_uid: 'firebase-uid',
      email: 'test@example.com',
      nickname: 'test',
    };
    const savedUser = { id: 1, ...createdUser };
    usersRepository.findOne.mockResolvedValue(null);
    usersRepository.create.mockReturnValue(createdUser);
    usersRepository.save.mockResolvedValue(savedUser);
    charactersRepository.find.mockResolvedValue([]);

    await expect(
      service.findOrCreateUser('firebase-uid', 'test@example.com'),
    ).resolves.toBe(savedUser);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(usersRepository.create).toHaveBeenCalledWith(createdUser);
    expect(usersRepository.save).toHaveBeenCalledWith(createdUser);
  });

  it('displayName이 있으면 기본 닉네임으로 우선 사용한다', async () => {
    const createdUser = {
      firebase_uid: 'firebase-uid',
      email: 'test@example.com',
      nickname: 'runner',
    };
    usersRepository.findOne.mockResolvedValue(null);
    usersRepository.create.mockReturnValue(createdUser);
    usersRepository.save.mockResolvedValue({ id: 1, ...createdUser });
    charactersRepository.find.mockResolvedValue([]);

    await service.findOrCreateUser(
      'firebase-uid',
      'test@example.com',
      'runner',
    );

    expect(usersRepository.create).toHaveBeenCalledWith(createdUser);
  });

  it('신규 사용자 생성과 기본 캐릭터 지급을 하나의 트랜잭션으로 처리한다', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const createdUser = {
      firebase_uid: 'firebase-uid',
      email: 'test@example.com',
      nickname: 'test',
    };
    const savedUser = { id: 1, ...createdUser };
    const starterCharacters = [
      {
        id: 11,
        grade: CharacterGrade.COMMON,
        type: CharacterType.ATTACK,
      },
      {
        id: 12,
        grade: CharacterGrade.COMMON,
        type: CharacterType.DEFENSE,
      },
      {
        id: 13,
        grade: CharacterGrade.COMMON,
        type: CharacterType.BUFF,
      },
    ];
    const userCharacter = { user_id: 1, character_id: 11 };
    usersRepository.findOne.mockResolvedValue(null);
    usersRepository.create.mockReturnValue(createdUser);
    usersRepository.save.mockResolvedValue(savedUser);
    charactersRepository.find.mockResolvedValue(starterCharacters);
    userCharactersRepository.create.mockReturnValue(userCharacter);
    userCharactersRepository.save.mockResolvedValue(userCharacter);

    await expect(
      service.findOrCreateUser('firebase-uid', 'test@example.com'),
    ).resolves.toBe(savedUser);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(charactersRepository.find).toHaveBeenCalledTimes(1);
    expect(userCharactersRepository.create).toHaveBeenCalledWith({
      user_id: 1,
      character_id: 11,
    });
    expect(userCharactersRepository.save).toHaveBeenCalledWith(userCharacter);
    jest.restoreAllMocks();
  });

  it('닉네임을 공백 제거 후 저장한다', async () => {
    const user = { id: 1, nickname: 'old' };
    usersRepository.findOne.mockResolvedValue(user);
    usersRepository.save.mockImplementation((value: User) =>
      Promise.resolve(value),
    );

    const result = await service.updateNickname(1, ' new-name ');

    expect(result.nickname).toBe('new-name');
    expect(usersRepository.save).toHaveBeenCalledWith({
      id: 1,
      nickname: 'new-name',
    });
  });

  it('빈 닉네임은 저장하지 않고 예외를 던진다', async () => {
    const user = { id: 1, nickname: 'old' };
    usersRepository.findOne.mockResolvedValue(user);

    await expect(service.updateNickname(1, '   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(usersRepository.save).not.toHaveBeenCalled();
  });

  describe('findByIdWithRepresentativeCharacter', () => {
    it('대표 캐릭터가 있으면 character 정보를 포함해 반환한다', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 1,
        nickname: 'runner',
        representative_character: {
          character: {
            name: '공격형1',
            type: 'attack',
            grade: 'common',
            image_url: 'attack_common',
          },
        },
      });

      const result = await service.findByIdWithRepresentativeCharacter(1);

      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['representative_character', 'representative_character.character'],
      });
      expect(result).toEqual({
        id: 1,
        nickname: 'runner',
        character: {
          name: '공격형1',
          type: 'attack',
          grade: 'common',
          imageUrl: 'attack_common',
        },
      });
    });

    it('대표 캐릭터 미설정 유저는 character: null을 반환한다', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 2,
        nickname: 'nochar',
        representative_character: null,
      });

      const result = await service.findByIdWithRepresentativeCharacter(2);

      expect(result).toEqual({ id: 2, nickname: 'nochar', character: null });
    });

    it('존재하지 않는 유저 ID는 NotFoundException을 던진다', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByIdWithRepresentativeCharacter(999),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('응답 객체는 API 명세에 맞는 camelCase 필드로 반환한다', () => {
    const user = {
      id: 1,
      email: 'test@example.com',
      nickname: 'test',
      points: 100,
      stat_points: 3,
      total_distance: 3.5,
    } as User;

    expect(service.toResponse(user)).toEqual({
      id: 1,
      email: 'test@example.com',
      nickname: 'test',
      points: 100,
      statPoints: 3,
      totalDistance: 3.5,
    });
  });
});
