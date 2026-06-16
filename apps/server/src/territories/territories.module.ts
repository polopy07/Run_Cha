import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Territory } from './entities/territory.entity';
import { TerritoriesController } from './territories.controller';
import { TerritoriesService } from './territories.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Territory]), UsersModule],
  controllers: [TerritoriesController],
  providers: [TerritoriesService],
  exports: [TerritoriesService],
})
export class TerritoriesModule {}
