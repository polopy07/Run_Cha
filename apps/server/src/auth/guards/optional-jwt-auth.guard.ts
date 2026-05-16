import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Request } from 'express';
import { getFirebaseAdmin } from '../firebase-admin.provider';

type AuthenticatedRequest = Request & {
  user?: DecodedIdToken;
};

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (
      typeof authorization === 'string' &&
      authorization.startsWith('Bearer ')
    ) {
      const idToken = authorization.replace('Bearer ', '');
      try {
        request.user = await getFirebaseAdmin().auth().verifyIdToken(idToken);
      } catch {
        // 유효하지 않은 토큰은 무시하고 비인증 상태로 통과
      }
    }

    return true;
  }
}
