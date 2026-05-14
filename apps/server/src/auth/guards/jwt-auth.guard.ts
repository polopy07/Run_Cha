import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getFirebaseAdmin } from '../firebase-admin.provider';
import { UsersService } from '../../users/users.service';
import type { User } from '../../users/entities/user.entity';

type AuthenticatedRequest = Request & {
  user?: User;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (
      typeof authorization !== 'string' ||
      !authorization.startsWith('Bearer ')
    ) {
      throw new UnauthorizedException('Authorization token is required');
    }

    const idToken = authorization.replace('Bearer ', '');

    try {
      const decodedToken = await getFirebaseAdmin()
        .auth()
        .verifyIdToken(idToken);

      request.user = await this.usersService.findOrCreateUser(
        decodedToken.uid,
        decodedToken.email || '',
      );
    } catch {
      throw new UnauthorizedException('유효하지 않은 Firebase 토큰입니다.');
    }

    return true;
  }
}
