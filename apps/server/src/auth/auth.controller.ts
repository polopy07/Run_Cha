import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body('idToken') idToken: string) {
    return this.authService.verifyFirebaseToken(idToken);
  }
}
