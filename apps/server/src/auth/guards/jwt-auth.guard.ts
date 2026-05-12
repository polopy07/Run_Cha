import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Request } from 'express';
import { getFirebaseAdmin } from '../firebase-admin.provider';

type AuthenticatedRequest = Request & {
  user?: DecodedIdToken;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
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
    request.user = await getFirebaseAdmin().auth().verifyIdToken(idToken);

    return true;
  }
}
