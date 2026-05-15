import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const mockRepository = {
    create: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('서비스가 정의되어 있어야 한다', () => {
    expect(service).toBeDefined();
  });

  it('기존 Firebase uid 사용자가 있으면 그대로 반환한다', async () => {
    const user = { id: 1, firebase_uid: 'firebase-uid' };
    mockRepository.findOne.mockResolvedValue(user);

    await expect(
      service.findOrCreateUser('firebase-uid', 'test@example.com'),
    ).resolves.toBe(user);
    expect(mockRepository.create).not.toHaveBeenCalled();
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('기존 사용자가 없으면 이메일 앞부분을 기본 닉네임으로 생성한다', async () => {
    const createdUser = {
      firebase_uid: 'firebase-uid',
      email: 'test@example.com',
      nickname: 'test',
    };
    const savedUser = { id: 1, ...createdUser };
    mockRepository.findOne.mockResolvedValue(null);
    mockRepository.create.mockReturnValue(createdUser);
    mockRepository.save.mockResolvedValue(savedUser);

    await expect(
      service.findOrCreateUser('firebase-uid', 'test@example.com'),
    ).resolves.toBe(savedUser);
    expect(mockRepository.create).toHaveBeenCalledWith(createdUser);
    expect(mockRepository.save).toHaveBeenCalledWith(createdUser);
  });

  it('displayName이 있으면 기본 닉네임으로 우선 사용한다', async () => {
    const createdUser = {
      firebase_uid: 'firebase-uid',
      email: 'test@example.com',
      nickname: 'runner',
    };
    mockRepository.findOne.mockResolvedValue(null);
    mockRepository.create.mockReturnValue(createdUser);
    mockRepository.save.mockResolvedValue(createdUser);

    await service.findOrCreateUser(
      'firebase-uid',
      'test@example.com',
      'runner',
    );

    expect(mockRepository.create).toHaveBeenCalledWith(createdUser);
  });

  it('닉네임을 공백 제거 후 저장한다', async () => {
    const user = { id: 1, nickname: 'old' };
    mockRepository.findOne.mockResolvedValue(user);
    mockRepository.save.mockImplementation((value: User) =>
      Promise.resolve(value),
    );

    const result = await service.updateNickname(1, ' new-name ');

    expect(result.nickname).toBe('new-name');
    expect(mockRepository.save).toHaveBeenCalledWith({
      id: 1,
      nickname: 'new-name',
    });
  });

  it('빈 닉네임은 저장하지 않고 예외를 던진다', async () => {
    const user = { id: 1, nickname: 'old' };
    mockRepository.findOne.mockResolvedValue(user);

    await expect(service.updateNickname(1, '   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('응답 객체는 API 명세에 맞는 camelCase 필드로 반환한다', () => {
    const user = {
      id: 1,
      email: 'test@example.com',
      nickname: 'test',
      points: 100,
      total_distance: 3.5,
      pity_count: 7,
    } as User;

    expect(service.toResponse(user)).toEqual({
      id: 1,
      email: 'test@example.com',
      nickname: 'test',
      points: 100,
      totalDistance: 3.5,
      pityCount: 7,
    });
  });
});
