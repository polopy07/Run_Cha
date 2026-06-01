import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';

const DEV_JWT_SECRET = 'run-territory-local-dev-secret';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const configuredSecret = config.get<string>('JWT_SECRET');
        const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
        const isProduction = nodeEnv === 'production';

        if (!configuredSecret && isProduction) {
          throw new Error(
            'JWT_SECRET is required in production. Set JWT_SECRET in the server environment.',
          );
        }

        if (!configuredSecret) {
          Logger.warn(
            `JWT_SECRET is not set. Using local development fallback secret. NODE_ENV=${nodeEnv}; set NODE_ENV=production in deployed environments.`,
            AuthModule.name,
          );
        }

        return {
          secret: configuredSecret ?? DEV_JWT_SECRET,
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
