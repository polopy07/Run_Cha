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
      throw new UnauthorizedException('Invalid Firebase token');
    }

    const displayName =
      typeof decodedToken.name === 'string' ? decodedToken.name : undefined;

    const user = await this.usersService.findOrCreateUser(
      decodedToken.uid,
      decodedToken.email || '',
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
