import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Territory } from '../territories/entities/territory.entity';
import { User } from '../users/entities/user.entity';
import { RankingController } from './ranking.controller';
import { RankingService } from './ranking.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Territory, User]), AuthModule],
  controllers: [RankingController],
  providers: [RankingService],
})
export class RankingModule {}
