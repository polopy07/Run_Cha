import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttackLog } from './entities/attack-log.entity';
import { AttacksController } from './attacks.controller';
import { AttacksService } from './attacks.service';
import { Territory } from '../territories/entities/territory.entity';
import { UsersModule } from '../users/users.module';
import { UserCharacter } from '../characters/entities/user-character.entity';
import { SocketModule } from '../socket/socket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttackLog, Territory, UserCharacter]),
    UsersModule,
    SocketModule,
  ],
  controllers: [AttacksController],
  providers: [AttacksService],
})
export class AttacksModule {}
