import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

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
    try {
      const decodedToken = await getFirebaseAdmin()
        .auth()
        .verifyIdToken(idToken);

      const user = await this.usersService.findOrCreateUser(
        decodedToken.uid,
        decodedToken.email || '',
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
    } catch {
      throw new UnauthorizedException('유효하지 않은 Firebase 토큰');
    }
  }
}
