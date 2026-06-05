import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersController', () => {
  let controller: UsersController;

  const mockUsersService = {
    toResponse: jest.fn(),
    updateNickname: jest.fn(),
    findByIdWithRepresentative: jest.fn(),
    setRepresentative: jest.fn(),
  };

  const user = {
    id: 1,
    email: 'test@example.com',
    nickname: 'test',
    points: 100,
    total_distance: 3.5,
  } as User;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('health는 ok를 반환한다', () => {
    expect(controller.health()).toEqual({ ok: true });
  });

  it('getMe는 현재 유저 응답을 반환한다', async () => {
    const loadedUser = { ...user, representative_character: null };
    const response = { id: 1, email: 'test@example.com' };
    mockUsersService.findByIdWithRepresentative.mockResolvedValue(loadedUser);
    mockUsersService.toResponse.mockReturnValue(response);

    await expect(controller.getMe(user)).resolves.toBe(response);
    expect(mockUsersService.findByIdWithRepresentative).toHaveBeenCalledWith(1);
    expect(mockUsersService.toResponse).toHaveBeenCalledWith(loadedUser);
  });

  it('setRepresentative는 대표 캐릭터를 설정하고 응답을 반환한다', async () => {
    const updatedUser = { ...user, representative_character_id: 10 };
    const response = { id: 1, representativeCharacter: { id: 10 } };
    mockUsersService.setRepresentative.mockResolvedValue(updatedUser);
    mockUsersService.toResponse.mockReturnValue(response);

    await expect(
      controller.setRepresentative(user, { userCharacterId: 10 }),
    ).resolves.toBe(response);
    expect(mockUsersService.setRepresentative).toHaveBeenCalledWith(1, 10);
    expect(mockUsersService.toResponse).toHaveBeenCalledWith(updatedUser);
  });

  it('updateNickname은 닉네임을 변경하고 대표 캐릭터 relation이 포함된 유저 응답을 반환한다', async () => {
    const loadedUser = {
      ...user,
      nickname: 'new-name',
      representative_character: null,
    };
    const response = {
      id: 1,
      nickname: 'new-name',
      representativeCharacter: null,
    };
    mockUsersService.updateNickname.mockResolvedValue(undefined);
    mockUsersService.findByIdWithRepresentative.mockResolvedValue(loadedUser);
    mockUsersService.toResponse.mockReturnValue(response);

    await expect(
      controller.updateNickname(user, { nickname: 'new-name' }),
    ).resolves.toBe(response);
    expect(mockUsersService.updateNickname).toHaveBeenCalledWith(1, 'new-name');
    expect(mockUsersService.findByIdWithRepresentative).toHaveBeenCalledWith(1);
    expect(mockUsersService.toResponse).toHaveBeenCalledWith(loadedUser);
  });
});
