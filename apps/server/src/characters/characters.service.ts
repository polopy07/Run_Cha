import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Territory } from '../territories/entities/territory.entity';
import { User } from '../users/entities/user.entity';
import { CharacterGrade, CharacterType } from './entities/character.entity';
import { UserCharacter } from './entities/user-character.entity';
import { UpgradeStat } from './dto/upgrade-character.dto';
import { DISMANTLE_MAX_COUNT } from './dto/dismantle-characters.dto';

const MAX_LEVEL_BY_GRADE: Record<CharacterGrade, number> = {
  [CharacterGrade.COMMON]: 10,
  [CharacterGrade.RARE]: 15,
  [CharacterGrade.EPIC]: 20,
  [CharacterGrade.LEGENDARY]: 30,
};

const UPGRADE_BASE_COST = 100;
const UPGRADE_MAX_COST = 5000;
const UPGRADE_MAX_COST_START_LEVEL = Math.ceil(
  Math.log(UPGRADE_MAX_COST / UPGRADE_BASE_COST) / Math.log(1.5),
);
const DISMANTLE_REWARD_BY_GRADE: Record<CharacterGrade, number> = {
  [CharacterGrade.COMMON]: 1,
  [CharacterGrade.RARE]: 2,
  [CharacterGrade.EPIC]: 3,
  [CharacterGrade.LEGENDARY]: 4,
};

type StatLevelColumn = 'attack_lv' | 'defense_lv';

const STAT_LEVEL_COLUMN: Record<UpgradeStat, StatLevelColumn> = {
  attack: 'attack_lv',
  defense: 'defense_lv',
};

@Injectable()
export class CharactersService {
  constructor(
    @InjectRepository(UserCharacter)
    private readonly userCharactersRepository: Repository<UserCharacter>,
    private readonly dataSource: DataSource,
  ) {}

  async findMine(userId: number) {
    const userCharacters = await this.userCharactersRepository.find({
      where: { user_id: userId },
      relations: { character: true },
      order: { id: 'ASC' },
    });

    return userCharacters.map((userCharacter) =>
      this.toUserCharacterResponse(userCharacter),
    );
  }

  async upgrade(userId: number, userCharacterId: number, stat: UpgradeStat) {
    return this.dataSource.transaction(async (manager) => {
      const userCharactersRepository = manager.getRepository(UserCharacter);
      const usersRepository = manager.getRepository(User);

      const userCharacter = await userCharactersRepository.findOne({
        where: { id: userCharacterId, user_id: userId },
        relations: { character: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!userCharacter) {
        throw new NotFoundException('보유 캐릭터를 찾을 수 없습니다.');
      }

      const levelColumn: StatLevelColumn = STAT_LEVEL_COLUMN[stat];
      const currentLevel = userCharacter[levelColumn];
      const maxLevel = MAX_LEVEL_BY_GRADE[userCharacter.character.grade];

      if (currentLevel >= maxLevel) {
        throw new BadRequestException('이미 최대 레벨입니다.');
      }

      const user = await usersRepository.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('사용자를 찾을 수 없습니다.');
      }

      const cost = this.calculateUpgradeCost(currentLevel);

      if (user.points < cost) {
        throw new BadRequestException('포인트가 부족합니다.');
      }

      user.points -= cost;
      userCharacter[levelColumn] = currentLevel + 1;

      await usersRepository.save(user);
      await userCharactersRepository.save(userCharacter);

      return {
        id: userCharacter.id,
        upgradedStat: stat,
        newLevel: currentLevel + 1,
        remainingPoints: user.points,
      };
    });
  }

  async deploy(
    userId: number,
    userCharacterId: number,
    territoryId: number | null,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const userCharactersRepository = manager.getRepository(UserCharacter);
      const territoriesRepository = manager.getRepository(Territory);

      const userCharacter = await userCharactersRepository.findOne({
        where: { id: userCharacterId, user_id: userId },
        relations: { character: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!userCharacter) {
        throw new NotFoundException('보유 캐릭터를 찾을 수 없습니다.');
      }

      if (
        ![CharacterType.DEFENSE, CharacterType.BUFF].includes(
          userCharacter.character.type,
        )
      ) {
        throw new BadRequestException(
          '수비형 또는 버프형 캐릭터만 영토에 배치할 수 있습니다.',
        );
      }

      if (territoryId !== null) {
        const territory = await territoriesRepository.findOne({
          where: { id: territoryId, user_id: userId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!territory) {
          throw new NotFoundException('배치할 영토를 찾을 수 없습니다.');
        }

        const existing = await userCharactersRepository.findOne({
          where: { user_id: userId, deployed_territory_id: territoryId },
          lock: { mode: 'pessimistic_write' },
        });

        if (existing && existing.id !== userCharacter.id) {
          throw new BadRequestException('이미 캐릭터가 배치된 영토입니다.');
        }
      }

      userCharacter.deployed_territory_id = territoryId;
      await userCharactersRepository.save(userCharacter);

      return this.toUserCharacterResponse(userCharacter);
    });
  }

  async dismantle(userId: number, userCharacterIds: number[]) {
    const uniqueIds = [...new Set(userCharacterIds)];

    if (userCharacterIds.length === 0) {
      throw new BadRequestException('At least one character is required.');
    }

    if (userCharacterIds.length > DISMANTLE_MAX_COUNT) {
      throw new BadRequestException(
        `You can dismantle up to ${DISMANTLE_MAX_COUNT} characters at once.`,
      );
    }

    if (uniqueIds.length !== userCharacterIds.length) {
      throw new BadRequestException('Duplicate character IDs are not allowed.');
    }

    return this.dataSource.transaction(async (manager) => {
      const userCharactersRepository = manager.getRepository(UserCharacter);
      const usersRepository = manager.getRepository(User);

      const user = await usersRepository.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!user) {
        throw new NotFoundException('User not found.');
      }

      const userCharacters = await userCharactersRepository
        .createQueryBuilder('userCharacter')
        .leftJoinAndSelect('userCharacter.character', 'character')
        .where('userCharacter.user_id = :userId', { userId })
        .andWhere('userCharacter.id IN (:...ids)', { ids: uniqueIds })
        .setLock('pessimistic_write')
        .getMany();

      if (userCharacters.length !== uniqueIds.length) {
        const ownedIds = new Set(
          userCharacters.map((userCharacter) => userCharacter.id),
        );
        const missingIds = uniqueIds.filter((id) => !ownedIds.has(id));

        throw new NotFoundException(
          `Owned character not found: ${missingIds.join(', ')}`,
        );
      }

      const deployedCharacters = userCharacters.filter(
        (userCharacter) => userCharacter.deployed_territory_id !== null,
      );

      if (deployedCharacters.length > 0) {
        throw new BadRequestException(
          `Deployed characters cannot be dismantled: ${deployedCharacters
            .map((userCharacter) => userCharacter.id)
            .join(', ')}`,
        );
      }

      const ownedCharacterCount = await userCharactersRepository
        .createQueryBuilder('ownedCharacter')
        .where('ownedCharacter.user_id = :userId', { userId })
        .setLock('pessimistic_read')
        .getCount();

      if (ownedCharacterCount - userCharacters.length < 1) {
        throw new BadRequestException(
          'At least one character must remain after dismantling.',
        );
      }

      const earnedStatPoints = userCharacters.reduce((sum, userCharacter) => {
        const grade = userCharacter.character?.grade;
        return sum + (grade ? DISMANTLE_REWARD_BY_GRADE[grade] : 0);
      }, 0);

      user.stat_points += earnedStatPoints;

      await userCharactersRepository.delete({
        id: In(uniqueIds),
        user_id: userId,
      });
      await usersRepository.save(user);

      const remainingCharacterCount = await userCharactersRepository.count({
        where: { user_id: userId },
      });

      return {
        dismantledCount: userCharacters.length,
        earnedStatPoints,
        statPoints: user.stat_points,
        remainingCharacterCount,
      };
    });
  }

  private calculateUpgradeCost(currentLevel: number) {
    if (currentLevel >= UPGRADE_MAX_COST_START_LEVEL) {
      return UPGRADE_MAX_COST;
    }

    const cost = Math.floor(UPGRADE_BASE_COST * 1.5 ** currentLevel);

    return Math.min(cost, UPGRADE_MAX_COST);
  }

  private toUserCharacterResponse(userCharacter: UserCharacter) {
    const deployedTerritoryId = userCharacter.deployed_territory_id ?? null;

    return {
      id: userCharacter.id,
      characterId: userCharacter.character_id,
      name: userCharacter.character.name,
      grade: userCharacter.character.grade,
      type: userCharacter.character.type,
      attackLv: userCharacter.attack_lv,
      defenseLv: userCharacter.defense_lv,
      isDeployed: deployedTerritoryId !== null,
      deployedTerritoryId,
    };
  }
}
