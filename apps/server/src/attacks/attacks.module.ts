import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttackLog } from './entities/attack-log.entity';
import { AttacksController } from './attacks.controller';
import { AttacksService } from './attacks.service';
import { RunningLog } from '../running/entities/running-log.entity';
import { Territory } from '../territories/entities/territory.entity';
import { UserCharacter } from '../characters/entities/user-character.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttackLog, RunningLog, Territory, UserCharacter]),
  ],
  controllers: [AttacksController],
  providers: [AttacksService],
})
export class AttacksModule {}
