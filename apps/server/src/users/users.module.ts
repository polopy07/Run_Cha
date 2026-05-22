import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Character } from '../characters/entities/character.entity';
import { UserCharacter } from '../characters/entities/user-character.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Character, UserCharacter])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
