import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Character,
  CharacterGrade,
  CharacterType,
} from '../characters/entities/character.entity';
import { UserCharacter } from '../characters/entities/user-character.entity';
import { User } from '../users/entities/user.entity';
import { GachaLog } from './entities/gacha-log.entity';

const DRAW_COST: Record<1 | 10, number> = {
  1: 100,
  10: 900,
};

const LEGENDARY_PITY_THRESHOLD = 99;

type GachaResult = {
  characterId: number;
  name: string;
  grade: CharacterGrade;
  type: CharacterType;
  isNew: boolean;
  isGuaranteed: boolean;
};

@Injectable()
export class GachaService {
  constructor(
    @InjectRepository(Character)
    private readonly charactersRepository: Repository<Character>,
    @InjectRepository(UserCharacter)
    private readonly userCharactersRepository: Repository<UserCharacter>,
    @InjectRepository(GachaLog)
    private readonly gachaLogsRepository: Repository<GachaLog>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async draw(userId: number, count: 1 | 10) {
    const cost = DRAW_COST[count];

    if (!cost) {
      throw new BadRequestException('뽑기 횟수는 1 또는 10만 가능합니다.');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    if (user.points < cost) {
      throw new BadRequestException('포인트가 부족합니다.');
    }

    const characters = await this.charactersRepository.find();

    if (characters.length === 0) {
      throw new NotFoundException('뽑기 가능한 캐릭터가 없습니다.');
    }

    const ownedCharacterIds = new Set(
      (
        await this.userCharactersRepository.find({
          where: { user_id: userId },
          select: { character_id: true },
        })
      ).map((userCharacter) => userCharacter.character_id),
    );

    user.points -= cost;

    const results: GachaResult[] = [];
    let pityCount = user.pity_count;

    for (let i = 0; i < count; i += 1) {
      const isGuaranteed = pityCount >= LEGENDARY_PITY_THRESHOLD;
      const grade = isGuaranteed ? CharacterGrade.LEGENDARY : this.pickGrade();
      const character = this.pickCharacterByGrade(characters, grade);
      const isNew = !ownedCharacterIds.has(character.id);

      const userCharacter = this.userCharactersRepository.create({
        user_id: userId,
        character_id: character.id,
      });
      await this.userCharactersRepository.save(userCharacter);

      pityCount =
        character.grade === CharacterGrade.LEGENDARY ? 0 : pityCount + 1;

      const gachaLog = this.gachaLogsRepository.create({
        user_id: userId,
        result_character_id: character.id,
        is_guaranteed: isGuaranteed,
        pity_count: pityCount,
      });
      await this.gachaLogsRepository.save(gachaLog);

      ownedCharacterIds.add(character.id);

      results.push({
        characterId: character.id,
        name: character.name,
        grade: character.grade,
        type: character.type,
        isNew,
        isGuaranteed,
      });
    }

    user.pity_count = pityCount;
    await this.usersRepository.save(user);

    return {
      results,
      remainingPoints: user.points,
    };
  }

  private pickGrade() {
    const value = Math.random();

    if (value < 0.6) return CharacterGrade.COMMON;
    if (value < 0.9) return CharacterGrade.RARE;
    if (value < 0.99) return CharacterGrade.EPIC;
    return CharacterGrade.LEGENDARY;
  }

  private pickCharacterByGrade(characters: Character[], grade: CharacterGrade) {
    const candidates = characters.filter(
      (character) => character.grade === grade,
    );

    if (candidates.length === 0) {
      throw new NotFoundException(`${grade} 등급 캐릭터가 없습니다.`);
    }

    const index = Math.floor(Math.random() * candidates.length);

    return candidates[index];
  }
}
