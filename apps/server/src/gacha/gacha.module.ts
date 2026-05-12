import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Character } from '../characters/entities/character.entity';
import { GachaController } from './gacha.controller';
import { GachaService } from './gacha.service';
import { GachaLog } from './entities/gacha-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Character, GachaLog])],
  controllers: [GachaController],
  providers: [GachaService],
})
export class GachaModule {}
