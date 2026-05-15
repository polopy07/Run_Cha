import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { DecodedIdToken } from 'firebase-admin/auth';

import { UsersService } from '../users/users.service';
import { getFirebaseAdmin } from './firebase-admin.provider';
import { AuthTokenPayload } from './types/auth-token-payload';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(idToken: string) {
    let decodedToken: DecodedIdToken;

    try {
      decodedToken = await getFirebaseAdmin().auth().verifyIdToken(idToken);
    } catch {
      throw new UnauthorizedException('유효하지 않은 Firebase 토큰입니다.');
    }

    if (!decodedToken.email) {
      throw new UnauthorizedException(
        'Firebase 토큰에 이메일 정보가 없습니다.',
      );
    }

    const displayName =
      typeof decodedToken.name === 'string' ? decodedToken.name : undefined;

    const user = await this.usersService.findOrCreateUser(
      decodedToken.uid,
      decodedToken.email,
      displayName,
    );

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      firebaseUid: user.firebase_uid,
      email: user.email,
    } satisfies AuthTokenPayload);

    return {
      accessToken,
      ...this.usersService.toResponse(user),
    };
  }
}
