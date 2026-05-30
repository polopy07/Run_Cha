import { BadRequestException } from '@nestjs/common';
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
