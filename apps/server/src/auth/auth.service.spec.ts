import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { getFirebaseAdmin } from './firebase-admin.provider';

jest.mock('./firebase-admin.provider', () => ({
  getFirebaseAdmin: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  const mockVerifyIdToken = jest.fn();
  const mockUsersService = {
    findOrCreateUser: jest.fn(),
    toResponse: jest.fn(),
  };
  const mockJwtService = {
    signAsync: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (getFirebaseAdmin as jest.Mock).mockReturnValue({
      auth: () => ({
        verifyIdToken: mockVerifyIdToken,
      }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('서비스가 정의되어 있어야 한다', () => {
    expect(service).toBeDefined();
  });

  it('Firebase 토큰 검증 후 사용자 응답과 서버 JWT를 반환한다', async () => {
    const user = {
      id: 1,
      firebase_uid: 'firebase-uid',
      email: 'test@example.com',
    };
    const userResponse = {
      id: 1,
      email: 'test@example.com',
      nickname: 'test',
      points: 0,
      totalDistance: 0,
    };
    mockVerifyIdToken.mockResolvedValue({
      uid: 'firebase-uid',
      email: 'test@example.com',
      name: 'tester',
    });
    mockUsersService.findOrCreateUser.mockResolvedValue(user);
    mockUsersService.toResponse.mockReturnValue(userResponse);
    mockJwtService.signAsync.mockResolvedValue('server-jwt');

    await expect(service.login('firebase-token')).resolves.toEqual({
      accessToken: 'server-jwt',
      ...userResponse,
    });
    expect(mockUsersService.findOrCreateUser).toHaveBeenCalledWith(
      'firebase-uid',
      'test@example.com',
      'tester',
    );
    expect(mockJwtService.signAsync).toHaveBeenCalledWith({
      sub: 1,
      firebaseUid: 'firebase-uid',
      email: 'test@example.com',
    });
  });

  it('Firebase 토큰 검증에 실패하면 401 예외를 던진다', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('invalid token'));

    await expect(service.login('wrong-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(mockUsersService.findOrCreateUser).not.toHaveBeenCalled();
  });

  it('Firebase 토큰에 이메일이 없으면 401 예외를 던진다', async () => {
    mockVerifyIdToken.mockResolvedValue({
      uid: 'firebase-uid',
    });

    await expect(service.login('firebase-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(mockUsersService.findOrCreateUser).not.toHaveBeenCalled();
  });
});
