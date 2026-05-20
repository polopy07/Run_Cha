import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { CharacterGrade } from './entities/character.entity';
import { UserCharacter } from './entities/user-character.entity';
import { UpgradeStat } from './dto/upgrade-character.dto';

const MAX_LEVEL_BY_GRADE: Record<CharacterGrade, number> = {
  [CharacterGrade.COMMON]: 10,
  [CharacterGrade.RARE]: 15,
  [CharacterGrade.EPIC]: 20,
  [CharacterGrade.LEGENDARY]: 30,
};

const UPGRADE_BASE_COST = 100;

type StatLevelColumn = 'attack_lv' | 'defense_lv' | 'speed_lv' | 'point_lv';

const STAT_LEVEL_COLUMN: Record<UpgradeStat, StatLevelColumn> = {
  attack: 'attack_lv',
  defense: 'defense_lv',
  speed: 'speed_lv',
  point: 'point_lv',
};

type DeploymentFields = {
  is_deployed?: boolean;
  deployed_territory_id?: number | null;
};

@Injectable()
export class CharactersService {
  constructor(
    @InjectRepository(UserCharacter)
    private readonly userCharactersRepository: Repository<UserCharacter>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
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
    const userCharacter = await this.userCharactersRepository.findOne({
      where: { id: userCharacterId, user_id: userId },
      relations: { character: true },
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

    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다.');
    }

    const cost = this.calculateUpgradeCost(currentLevel);

    if (user.points < cost) {
      throw new BadRequestException('포인트가 부족합니다.');
    }

    user.points -= cost;
    userCharacter[levelColumn] = currentLevel + 1;

    await this.usersRepository.save(user);
    await this.userCharactersRepository.save(userCharacter);

    return {
      id: userCharacter.id,
      upgradedStat: stat,
      newLevel: currentLevel + 1,
      remainingPoints: user.points,
    };
  }

  private calculateUpgradeCost(currentLevel: number) {
    return Math.floor(UPGRADE_BASE_COST * 1.5 ** currentLevel);
  }

  private toUserCharacterResponse(userCharacter: UserCharacter) {
    const deployment = userCharacter as UserCharacter & DeploymentFields;
    const deployedTerritoryId = deployment.deployed_territory_id ?? null;

    return {
      id: userCharacter.id,
      characterId: userCharacter.character_id,
      name: userCharacter.character.name,
      grade: userCharacter.character.grade,
      type: userCharacter.character.type,
      attackLv: userCharacter.attack_lv,
      defenseLv: userCharacter.defense_lv,
      speedLv: userCharacter.speed_lv,
      pointLv: userCharacter.point_lv,
      isDeployed: deployedTerritoryId !== null || Boolean(deployment.is_deployed),
      deployedTerritoryId,
    };
  }
}
