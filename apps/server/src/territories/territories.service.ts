import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
      where: { user_id: userId },
      order: { id: 'ASC' },
      select: {
        id: true,
        user_id: true,
        coordinates: true,
        area_sqm: true,
        occupation_rate: true,
        last_active_at: true,
      },
    });

    return territories.map((t) => this.toOwnedTerritoryResponse(t));
  }

  async findInBounds(dto: GetTerritoriesDto) {
    const { minLat, maxLat, minLng, maxLng } = dto;

    const territories = await this.territoryRepo
      .createQueryBuilder('t')
      .where('t.center_lat BETWEEN :minLat AND :maxLat', { minLat, maxLat })
      .andWhere('t.center_lng BETWEEN :minLng AND :maxLng', { minLng, maxLng })
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
        attackLv: userCharacter.attack_lv,
        defenseLv: userCharacter.defense_lv,
        speedLv: userCharacter.speed_lv,
        pointLv: userCharacter.point_lv,
      })),
    };
  }

  async registerTerritory(
    userId: number,
    coordinates: { lat: number; lng: number }[],
    areaSqm: number,
  ): Promise<Territory> {
    const center = calcCenter(coordinates);
    const territory = this.territoryRepo.create({
      user_id: userId,
      coordinates,
      area_sqm: areaSqm,
      occupation_rate: 100,
      center_lat: center.lat,
      center_lng: center.lng,
    });
    return this.territoryRepo.save(territory);
  }

  private toPublicTerritoryResponse(territory: Territory) {
    return {
      id: territory.id,
      userId: territory.user_id,
      coordinates: territory.coordinates,
      areaSqm: territory.area_sqm,
      occupationRate: territory.occupation_rate,
    };
  }

  private toOwnedTerritoryResponse(territory: Territory) {
    return {
      ...this.toPublicTerritoryResponse(territory),
      userId: territory.user_id,
      lastActiveAt: territory.last_active_at,
    };
  }
}
