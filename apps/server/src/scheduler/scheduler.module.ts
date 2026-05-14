import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Territory } from '../territories/entities/territory.entity';
import { TerritoryDecayService } from './territory-decay.service';

@Module({
  imports: [TypeOrmModule.forFeature([Territory])],
  providers: [TerritoryDecayService],
})
export class SchedulerModule {}
