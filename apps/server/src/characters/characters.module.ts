import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CharactersController } from './characters.controller';
import { CharactersService } from './characters.service';
import { Character } from './entities/character.entity';
import { UserCharacter } from './entities/user-character.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { Territory } from '../territories/entities/territory.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Character, UserCharacter, User, Territory]),
    UsersModule,
  ],
  controllers: [CharactersController],
  providers: [CharactersService],
  exports: [CharactersService],
})
export class CharactersModule {}
