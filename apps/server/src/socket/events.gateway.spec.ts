import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { distanceKm, EventsGateway } from './events.gateway';
import { UsersService } from '../users/users.service';

const BASE = { lat: 37.5665, lng: 126.978 };
const NEAR = { lat: 37.5665, lng: 126.993 };
const FAR = { lat: 37.5665, lng: 127.028 };

type OnlineUser = {
  userId: number;
  nickname: string;
  lat: number;
  lng: number;
  character: unknown;
  hasLocation: boolean;
};

interface GatewayInternal {
  onlineUsers: Map<string, OnlineUser>;
  userSockets: Map<number, Set<string>>;
  server: { to: jest.Mock };
}

function internal(gateway: EventsGateway): GatewayInternal {
  return gateway as unknown as GatewayInternal;
}

function makeSocket(id: string, token?: string): Socket {
  return {
    id,
    handshake: { auth: token ? { token } : {} },
    disconnect: jest.fn(),
  } as unknown as Socket;
}

function addUser(
  gateway: EventsGateway,
  socketId: string,
  overrides: Partial<OnlineUser> = {},
) {
  const user: OnlineUser = {
    userId: 1,
    nickname: 'test',
    lat: 0,
    lng: 0,
    character: null,
    hasLocation: false,
    ...overrides,
  };
  internal(gateway).onlineUsers.set(socketId, user);

  const sockets =
    internal(gateway).userSockets.get(user.userId) ?? new Set<string>();
  sockets.add(socketId);
  internal(gateway).userSockets.set(user.userId, sockets);
}

describe('distanceKm', () => {
  it('같은 좌표는 0을 반환한다', () => {
    expect(distanceKm(37.5665, 126.978, 37.5665, 126.978)).toBeCloseTo(0);
  });

  it('서울 기준 0.015도 경도 차는 약 1.3km이다', () => {
    const d = distanceKm(BASE.lat, BASE.lng, NEAR.lat, NEAR.lng);
    expect(d).toBeGreaterThan(1.2);
    expect(d).toBeLessThan(1.5);
  });

  it('서울 기준 0.05도 경도 차는 2km를 초과한다', () => {
    const d = distanceKm(BASE.lat, BASE.lng, FAR.lat, FAR.lng);
    expect(d).toBeGreaterThan(2);
  });
});

describe('EventsGateway', () => {
  let gateway: EventsGateway;

  const mockJwtService = { verifyAsync: jest.fn() };
  const mockUsersService = { findByIdWithRepresentativeCharacter: jest.fn() };

  let mockEmit: jest.Mock;
  let mockTo: jest.Mock;

  const userInfo = {
    id: 1,
    nickname: 'runner',
    character: {
      name: '공격형1',
      type: 'attack',
      grade: 'common',
      imageUrl: 'attack_common',
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockEmit = jest.fn();
    mockTo = jest.fn(() => ({ emit: mockEmit }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsGateway,
        { provide: JwtService, useValue: mockJwtService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    gateway = module.get<EventsGateway>(EventsGateway);
    internal(gateway).server = { to: mockTo };
  });

  describe('handleConnection', () => {
    it('토큰이 없으면 disconnect를 호출한다', async () => {
      const client = makeSocket('s1');
      await gateway.handleConnection(client);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(client.disconnect).toHaveBeenCalled();
      expect(internal(gateway).onlineUsers.size).toBe(0);
    });

    it('유효하지 않은 토큰이면 disconnect를 호출한다', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('invalid'));
      const client = makeSocket('s1', 'bad-token');
      await gateway.handleConnection(client);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(client.disconnect).toHaveBeenCalled();
      expect(internal(gateway).onlineUsers.size).toBe(0);
    });

    it('유효한 토큰이면 onlineUsers에 저장한다', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1 });
      mockUsersService.findByIdWithRepresentativeCharacter.mockResolvedValue(
        userInfo,
      );

      const client = makeSocket('s1', 'valid-token');
      await gateway.handleConnection(client);

      const stored = internal(gateway).onlineUsers.get('s1');
      expect(stored).toMatchObject({
        userId: 1,
        nickname: 'runner',
        lat: 0,
        lng: 0,
        hasLocation: false,
        character: userInfo.character,
      });
    });

    it('대표 캐릭터 미설정 유저는 character: null로 저장한다', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 2 });
      mockUsersService.findByIdWithRepresentativeCharacter.mockResolvedValue({
        id: 2,
        nickname: 'nochar',
        character: null,
      });

      const client = makeSocket('s2', 'valid-token');
      await gateway.handleConnection(client);

      expect(internal(gateway).onlineUsers.get('s2')?.character).toBeNull();
    });
  });

  describe('handleDisconnect', () => {
    it('Map에 없는 소켓은 무시한다', () => {
      gateway.handleDisconnect(makeSocket('unknown'));
      expect(mockTo).not.toHaveBeenCalled();
    });

    it('위치 없는 유저는 user:offline을 발행하지 않는다', () => {
      addUser(gateway, 's1', { hasLocation: false });
      gateway.handleDisconnect(makeSocket('s1'));
      expect(mockTo).not.toHaveBeenCalled();
      expect(internal(gateway).onlineUsers.has('s1')).toBe(false);
    });

    it('위치 있는 유저가 끊기면 근처 유저에게 user:offline을 발행한다', () => {
      addUser(gateway, 's1', { userId: 1, ...BASE, hasLocation: true });
      addUser(gateway, 's2', { userId: 2, ...NEAR, hasLocation: true });

      gateway.handleDisconnect(makeSocket('s1'));

      expect(mockTo).toHaveBeenCalledWith('s2');
      expect(mockEmit).toHaveBeenCalledWith('user:offline', { userId: 1 });
      expect(internal(gateway).onlineUsers.has('s1')).toBe(false);
    });

    it('2km 초과 유저에게는 user:offline을 발행하지 않는다', () => {
      addUser(gateway, 's1', { userId: 1, ...BASE, hasLocation: true });
      addUser(gateway, 's2', { userId: 2, ...FAR, hasLocation: true });

      gateway.handleDisconnect(makeSocket('s1'));

      expect(mockTo).not.toHaveBeenCalled();
    });
  });

  describe('handleLocationUpdate', () => {
    it('data가 null이면 무시한다', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1 });
      mockUsersService.findByIdWithRepresentativeCharacter.mockResolvedValue(
        userInfo,
      );
      const client = makeSocket('s1', 'token');
      await gateway.handleConnection(client);

      gateway.handleLocationUpdate(
        client,
        null as unknown as { lat: number; lng: number },
      );

      expect(mockTo).not.toHaveBeenCalled();
      expect(internal(gateway).onlineUsers.get('s1')?.hasLocation).toBe(false);
    });

    it('lat/lng이 숫자가 아니면 무시한다', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1 });
      mockUsersService.findByIdWithRepresentativeCharacter.mockResolvedValue(
        userInfo,
      );
      const client = makeSocket('s1', 'token');
      await gateway.handleConnection(client);

      gateway.handleLocationUpdate(client, { lat: NaN, lng: 126.978 });

      expect(mockTo).not.toHaveBeenCalled();
    });

    it('첫 location:update는 근처 유저에게 user:online을 발행한다', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1 });
      mockUsersService.findByIdWithRepresentativeCharacter.mockResolvedValue(
        userInfo,
      );
      const client = makeSocket('s1', 'token');
      await gateway.handleConnection(client);
      addUser(gateway, 's2', { userId: 2, ...NEAR, hasLocation: true });

      gateway.handleLocationUpdate(client, BASE);

      expect(mockTo).toHaveBeenCalledWith('s2');
      expect(mockEmit).toHaveBeenCalledWith(
        'user:online',
        expect.objectContaining({
          userId: 1,
          lat: BASE.lat,
          lng: BASE.lng,
        }),
      );
    });

    it('두 번째 이후 location:update는 location:broadcast를 발행한다', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1 });
      mockUsersService.findByIdWithRepresentativeCharacter.mockResolvedValue(
        userInfo,
      );
      const client = makeSocket('s1', 'token');
      await gateway.handleConnection(client);
      addUser(gateway, 's2', { userId: 2, ...NEAR, hasLocation: true });

      gateway.handleLocationUpdate(client, BASE);
      jest.clearAllMocks();
      mockEmit = jest.fn();
      mockTo.mockReturnValue({ emit: mockEmit });

      gateway.handleLocationUpdate(client, NEAR);

      expect(mockEmit).toHaveBeenCalledWith(
        'location:broadcast',
        expect.objectContaining({ userId: 1 }),
      );
    });

    it('2km 초과 유저에게는 발행하지 않는다', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1 });
      mockUsersService.findByIdWithRepresentativeCharacter.mockResolvedValue(
        userInfo,
      );
      const client = makeSocket('s1', 'token');
      await gateway.handleConnection(client);
      addUser(gateway, 's2', { userId: 2, ...FAR, hasLocation: true });

      gateway.handleLocationUpdate(client, BASE);

      expect(mockTo).not.toHaveBeenCalled();
    });

    it('위치 없는 유저에게는 발행하지 않는다', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 1 });
      mockUsersService.findByIdWithRepresentativeCharacter.mockResolvedValue(
        userInfo,
      );
      const client = makeSocket('s1', 'token');
      await gateway.handleConnection(client);
      addUser(gateway, 's2', { userId: 2, ...NEAR, hasLocation: false });

      gateway.handleLocationUpdate(client, BASE);

      expect(mockTo).not.toHaveBeenCalled();
    });
  });
});
