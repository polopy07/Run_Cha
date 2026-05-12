import { Injectable, UnauthorizedException } from '@nestjs/common';

import { UsersService } from '../users/users.service';
import { firebaseAdmin } from './firebase-admin.provider';


@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async verifyFirebaseToken(idToken: string) {
    try {
      const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);

      const user = await this.usersService.findOrCreateUser(
        decodedToken.uid,
        decodedToken.email || '',
      );

      return {
        message: 'Firebase ID Token 검증 성공',
        uid: decodedToken.uid,
        email: decodedToken.email,
        user,
      };
    } catch (error) {
      console.log('Firebase token verify error:', error);
      throw new UnauthorizedException('유효하지 않은 Firebase 토큰');
    }
  }
}
