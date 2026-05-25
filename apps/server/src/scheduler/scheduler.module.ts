import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Territory } from '../territories/entities/territory.entity';
import { TerritoryDecayService } from './territory-decay.service';
import { TerritoryIncomeService } from './territory-income.service';

@Module({
  imports: [TypeOrmModule.forFeature([Territory])],
  providers: [TerritoryDecayService, TerritoryIncomeService],
})
export class SchedulerModule {}
