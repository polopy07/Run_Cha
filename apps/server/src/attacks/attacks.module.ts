import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttackLog } from './entities/attack-log.entity';
import { AttacksController } from './attacks.controller';
import { AttacksService } from './attacks.service';
import { RunningLog } from '../running/entities/running-log.entity';
import { Territory } from '../territories/entities/territory.entity';
import { UsersModule } from '../users/users.module';
import { UserCharacter } from '../characters/entities/user-character.entity';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttackLog, RunningLog, Territory, UserCharacter]),
    UsersModule,
    SocketModule,
  ],
  controllers: [AttacksController],
  providers: [AttacksService],
})
export class AttacksModule {}
