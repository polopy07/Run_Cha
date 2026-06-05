import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Territory } from './entities/territory.entity';
import { GetTerritoriesDto } from './dto/get-territories.dto';
import { UserCharacter } from '../characters/entities/user-character.entity';
import { calcCenter } from '../common/utils/geo';

@Injectable()
export class TerritoriesService {
  constructor(
    @InjectRepository(Territory)
    private readonly territoryRepo: Repository<Territory>,
    @InjectRepository(UserCharacter)
    private readonly userCharactersRepo: Repository<UserCharacter>,
  ) {}

  async findMine(userId: number) {
    const territories = await this.territoryRepo.find({
      where: {
        user_id: userId,
        area_sqm: MoreThan(0),
        occupation_rate: MoreThan(0),
      },
      order: { id: 'ASC' },
      relations: ['user'],
      select: {
        id: true,
        user_id: true,
        name: true,
        coordinates: true,
        area_sqm: true,
        occupation_rate: true,
        last_active_at: true,
        user: { id: true, nickname: true },
      },
    });

    return territories.map((t) => this.toOwnedTerritoryResponse(t));
  }

  async findInBounds(dto: GetTerritoriesDto) {
    const { minLat, maxLat, minLng, maxLng } = dto;

    const territories = await this.territoryRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.user', 'u')
      .where('t.center_lat BETWEEN :minLat AND :maxLat', { minLat, maxLat })
      .andWhere('t.center_lng BETWEEN :minLng AND :maxLng', { minLng, maxLng })
      .andWhere('t.area_sqm > 0')
      .andWhere('t.occupation_rate > 0')
      .getMany();

    return territories.map((t) => this.toPublicTerritoryResponse(t));
  }

  async findOne(id: number, currentUserId: number | null) {
    const territory = await this.territoryRepo.findOne({
      where: { id },
      relations: ['user'],
      select: {
        id: true,
        user_id: true,
        name: true,
        coordinates: true,
        area_sqm: true,
        occupation_rate: true,
        last_active_at: true,
        user: { id: true, nickname: true },
      },
    });

    if (!territory) {
      throw new NotFoundException('영토를 찾을 수 없습니다.');
    }

    const deployedCharacters = await this.userCharactersRepo.find({
      where: { deployed_territory_id: id },
      relations: { character: true },
      order: { id: 'ASC' },
    });

    return {
      id: territory.id,
      name: territory.name,
      coordinates: territory.coordinates,
      areaSqm: territory.area_sqm,
      occupationRate: territory.occupation_rate,
      lastActiveAt: territory.last_active_at,
      owner: {
        id: territory.user.id,
        nickname: territory.user.nickname,
      },
      isMine: currentUserId !== null && territory.user_id === currentUserId,
      deployedCharacters: deployedCharacters.map((userCharacter) => ({
        id: userCharacter.id,
        characterId: userCharacter.character_id,
        name: userCharacter.character.name,
        grade: userCharacter.character.grade,
        type: userCharacter.character.type,
        basePointRate: userCharacter.character.base_point_rate,
        attackLv: userCharacter.attack_lv,
        defenseLv: userCharacter.defense_lv,
        pointLv: userCharacter.point_lv,
      })),
    };
  }

  async registerTerritory(
    userId: number,
    coordinates: { lat: number; lng: number }[],
    areaSqm: number,
    name?: string | null,
  ): Promise<Territory> {
    const center = calcCenter(coordinates);
    const territory = this.territoryRepo.create({
      user_id: userId,
      name: name ?? null,
      coordinates,
      area_sqm: areaSqm,
      occupation_rate: 100,
      center_lat: center.lat,
      center_lng: center.lng,
    });
    return this.territoryRepo.save(territory);
  }

  async updateName(
    id: number,
    userId: number,
    name: string | null,
  ): Promise<{ id: number; name: string | null }> {
    const territory = await this.territoryRepo.findOne({
      where: { id },
      select: { id: true, user_id: true },
    });

    if (!territory) {
      throw new NotFoundException('영토를 찾을 수 없습니다.');
    }
    if (territory.user_id !== userId) {
      throw new ForbiddenException('본인 소유의 영토만 수정할 수 있습니다.');
    }

    await this.territoryRepo.update(id, { name });

    return { id, name };
  }

  private toPublicTerritoryResponse(territory: Territory) {
    return {
      id: territory.id,
      userId: territory.user_id,
      name: territory.name,
      ownerNickname: territory.user?.nickname ?? null,
      coordinates: territory.coordinates,
      areaSqm: territory.area_sqm,
      occupationRate: territory.occupation_rate,
    };
  }

  private toOwnedTerritoryResponse(territory: Territory) {
    return {
      ...this.toPublicTerritoryResponse(territory),
      lastActiveAt: territory.last_active_at,
    };
  }
}
