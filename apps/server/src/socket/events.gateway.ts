import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuthTokenPayload } from '../auth/types/auth-token-payload';

type CharacterInfo = {
  name: string;
  type: string;
  grade: string;
  imageUrl: string | null;
};

type OnlineUser = {
  userId: number;
  nickname: string;
  lat: number;
  lng: number;
  character: CharacterInfo | null;
  hasLocation: boolean;
};

export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server: Server;

  private readonly onlineUsers = new Map<string, OnlineUser>();
  private readonly userSockets = new Map<number, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<AuthTokenPayload>(token);
      const user = await this.usersService.findByIdWithRepresentativeCharacter(
        payload.sub,
      );

      this.onlineUsers.set(client.id, {
        userId: user.id,
        nickname: user.nickname,
        lat: 0,
        lng: 0,
        character: user.character,
        hasLocation: false,
      });

      const sockets = this.userSockets.get(user.id) ?? new Set<string>();
      sockets.add(client.id);
      this.userSockets.set(user.id, sockets);
    } catch (err) {
      console.warn('[EventsGateway] handleConnection failed:', err);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = this.onlineUsers.get(client.id);
    if (!user) return;

    this.onlineUsers.delete(client.id);

    const sockets = this.userSockets.get(user.userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(user.userId);
      }
    }

    // 마지막 소켓이 끊길 때만 user:offline 발행
    if (user.hasLocation && (sockets?.size ?? 0) === 0) {
      this.broadcastToNearby(client.id, user, 'user:offline', {
        userId: user.userId,
      });
    }
  }

  @SubscribeMessage('location:update')
  handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { lat: number; lng: number },
  ) {
    const user = this.onlineUsers.get(client.id);
    if (!user) return;

    if (
      !data ||
      typeof data.lat !== 'number' ||
      typeof data.lng !== 'number' ||
      !isFinite(data.lat) ||
      !isFinite(data.lng)
    ) {
      return;
    }

    const isFirst = !user.hasLocation;
    user.lat = data.lat;
    user.lng = data.lng;
    user.hasLocation = true;

    const event = isFirst ? 'user:online' : 'location:broadcast';
    this.broadcastToNearby(client.id, user, event, this.toPayload(user));
  }

  broadcastRankingUpdate() {
    this.server?.emit('ranking:update');
  }

  broadcastTerritoryUpdate(centerLat: number, centerLng: number) {
    const emittedUserIds = new Set<number>();
    for (const [, user] of this.onlineUsers) {
      if (!user.hasLocation) continue;
      if (emittedUserIds.has(user.userId)) continue;
      if (distanceKm(centerLat, centerLng, user.lat, user.lng) <= 2) {
        for (const sid of this.userSockets.get(user.userId) ?? []) {
          this.server.to(sid).emit('territory:update');
        }
        emittedUserIds.add(user.userId);
      }
    }
  }

  private broadcastToNearby(
    senderSocketId: string,
    sender: OnlineUser,
    event: string,
    payload: unknown,
  ) {
    const emittedUserIds = new Set<number>();
    for (const [socketId, user] of this.onlineUsers) {
      if (socketId === senderSocketId) continue;
      if (user.userId === sender.userId) continue;
      if (!user.hasLocation) continue;
      if (emittedUserIds.has(user.userId)) continue;
      if (distanceKm(sender.lat, sender.lng, user.lat, user.lng) <= 2) {
        for (const sid of this.userSockets.get(user.userId) ?? []) {
          this.server.to(sid).emit(event, payload);
        }
        emittedUserIds.add(user.userId);
      }
    }
  }

  private toPayload(user: OnlineUser) {
    return {
      userId: user.userId,
      nickname: user.nickname,
      lat: user.lat,
      lng: user.lng,
      character: user.character,
    };
  }
}
