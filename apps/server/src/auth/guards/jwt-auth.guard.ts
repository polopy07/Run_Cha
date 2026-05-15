import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { UsersService } from '../../users/users.service';
import type { User } from '../../users/entities/user.entity';
import { AuthTokenPayload } from '../types/auth-token-payload';

type AuthenticatedRequest = Request & {
  user?: User;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (
      typeof authorization !== 'string' ||
      !authorization.startsWith('Bearer ')
    ) {
      throw new UnauthorizedException('인증 토큰이 필요합니다.');
    }

    const accessToken = authorization.replace('Bearer ', '');

    try {
      const payload =
        await this.jwtService.verifyAsync<AuthTokenPayload>(accessToken);

      request.user = await this.usersService.findById(payload.sub);
    } catch {
      throw new UnauthorizedException('유효하지 않은 인증 토큰입니다.');
    }

    return true;
  }
}
