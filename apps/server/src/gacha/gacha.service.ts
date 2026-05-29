import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
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

const CHARACTER_CACHE_TTL_MS = 5 * 60 * 1000;

type GachaCharacter = Pick<Character, 'id' | 'name' | 'grade' | 'type'>;
type CharacterPool = Record<CharacterGrade, GachaCharacter[]>;

type DrawCandidate = {
  character: GachaCharacter;
};

type GachaResult = {
  characterId: number;
  name: string;
  grade: CharacterGrade;
  type: CharacterType;
  isNew: boolean;
};

@Injectable()
export class GachaService {
  private characterCache: CharacterPool | null = null;
  private characterCacheExpiresAt = 0;
  private characterCachePromise: Promise<CharacterPool> | null = null;

  constructor(
    @InjectRepository(Character)
    private readonly charactersRepository: Repository<Character>,
    private readonly dataSource: DataSource,
  ) {}

  async draw(userId: number, count: 1 | 10) {
    const cost = DRAW_COST[count];
    const characterPool = await this.getCharacterPool();

    if (this.countCharacters(characterPool) === 0) {
      throw new InternalServerErrorException('뽑기 가능한 캐릭터가 없습니다.');
    }

    return this.dataSource.transaction(async (manager) => {
      const usersRepository = manager.getRepository(User);
      const userCharactersRepository = manager.getRepository(UserCharacter);
      const gachaLogsRepository = manager.getRepository(GachaLog);

      const user = await usersRepository.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      if (user.points < cost) {
        throw new BadRequestException('포인트가 부족합니다.');
      }

      const drawCandidates: DrawCandidate[] = [];

      for (let i = 0; i < count; i += 1) {
        const grade = this.pickGrade();
        const character = this.pickCharacterByGrade(characterPool, grade);

        drawCandidates.push({
          character,
        });
      }

      const drawnCharacterIds = [
        ...new Set(drawCandidates.map(({ character }) => character.id)),
      ];
      const ownedCharacterIds = new Set(
        (
          await userCharactersRepository.find({
            where: { user_id: userId, character_id: In(drawnCharacterIds) },
            select: { character_id: true },
          })
        ).map((userCharacter) => userCharacter.character_id),
      );

      const results: GachaResult[] = [];
      const userCharacters: Partial<UserCharacter>[] = [];
      const gachaLogs: Partial<GachaLog>[] = [];

      for (const { character } of drawCandidates) {
        const isNew = !ownedCharacterIds.has(character.id);

        userCharacters.push({
          user_id: userId,
          character_id: character.id,
        });
        gachaLogs.push({
          user_id: userId,
          result_character_id: character.id,
          is_guaranteed: false,
          pity_count: 0,
        });
        ownedCharacterIds.add(character.id);

        results.push({
          characterId: character.id,
          name: character.name,
          grade: character.grade,
          type: character.type,
          isNew,
        });
      }

      await userCharactersRepository.insert(userCharacters);
      await gachaLogsRepository.insert(gachaLogs);

      user.points -= cost;
      await usersRepository.save(user);

      return {
        results,
        remainingPoints: user.points,
      };
    });
  }

  private async getCharacterPool() {
    const now = Date.now();

    if (this.characterCache && now < this.characterCacheExpiresAt) {
      return this.characterCache;
    }

    if (!this.characterCachePromise) {
      this.characterCachePromise = this.loadCharacterPool().finally(() => {
        this.characterCachePromise = null;
      });
    }

    return this.characterCachePromise;
  }

  private async loadCharacterPool() {
    const characters: GachaCharacter[] = await this.charactersRepository.find({
      select: {
        id: true,
        name: true,
        grade: true,
        type: true,
      },
    });

    const pool = this.createEmptyCharacterPool();

    for (const character of characters) {
      pool[character.grade].push(character);
    }

    this.characterCache = pool;
    this.characterCacheExpiresAt = Date.now() + CHARACTER_CACHE_TTL_MS;

    return pool;
  }

  private createEmptyCharacterPool(): CharacterPool {
    return {
      [CharacterGrade.COMMON]: [],
      [CharacterGrade.RARE]: [],
      [CharacterGrade.EPIC]: [],
      [CharacterGrade.LEGENDARY]: [],
    };
  }

  private countCharacters(pool: CharacterPool) {
    return Object.values(pool).reduce(
      (total, characters) => total + characters.length,
      0,
    );
  }

  private pickGrade() {
    const value = Math.random();

    if (value < 0.6) return CharacterGrade.COMMON;
    if (value < 0.9) return CharacterGrade.RARE;
    if (value < 0.99) return CharacterGrade.EPIC;
    return CharacterGrade.LEGENDARY;
  }

  private pickCharacterByGrade(pool: CharacterPool, grade: CharacterGrade) {
    const candidates = pool[grade];

    if (candidates.length === 0) {
      throw new InternalServerErrorException(
        `${grade} 등급 캐릭터가 없습니다.`,
      );
    }

    const index = Math.floor(Math.random() * candidates.length);

    return candidates[index];
  }
}
