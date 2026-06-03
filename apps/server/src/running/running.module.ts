import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RunningLog } from './entities/running-log.entity';
import { User } from '../users/entities/user.entity';
import { RunningController } from './running.controller';
import { RunningService } from './running.service';
import { UsersModule } from '../users/users.module';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [TypeOrmModule.forFeature([RunningLog, User]), UsersModule, SocketModule],
  controllers: [RunningController],
  providers: [RunningService],
})
export class RunningModule {}
