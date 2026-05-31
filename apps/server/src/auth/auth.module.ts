import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');

        if (!secret) {
          throw new Error(
            'JWT_SECRET is required. Copy apps/server/.env.example to apps/server/.env and set JWT_SECRET.',
          );
        }

        return {
          secret,
          signOptions: {
            expiresIn: config.get('JWT_EXPIRES_IN', '7d'),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OptionalJwtAuthGuard],
  exports: [OptionalJwtAuthGuard],
})
export class AuthModule {}
