import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RunningLog } from './entities/running-log.entity';
import { User } from '../users/entities/user.entity';
import { RunningController } from './running.controller';
import { RunningService } from './running.service';
import { TerritoriesModule } from '../territories/territories.module';

@Module({
  imports: [TypeOrmModule.forFeature([RunningLog, User]), TerritoriesModule],
  controllers: [RunningController],
  providers: [RunningService],
})
export class RunningModule {}
