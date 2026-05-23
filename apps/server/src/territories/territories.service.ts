import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Territory } from './entities/territory.entity';
import { GetTerritoriesDto } from './dto/get-territories.dto';
import { calcCenter } from '../common/utils/geo';

@Injectable()
export class TerritoriesService {
  constructor(
    @InjectRepository(Territory)
    private readonly territoryRepo: Repository<Territory>,
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

    return territories.map((t) => this.toTerritoryResponse(t));
  }

  async findInBounds(dto: GetTerritoriesDto) {
    const { minLat, maxLat, minLng, maxLng } = dto;

    const territories = await this.territoryRepo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.user', 'u')
      .where('t.center_lat BETWEEN :minLat AND :maxLat', { minLat, maxLat })
      .andWhere('t.center_lng BETWEEN :minLng AND :maxLng', { minLng, maxLng })
      .getMany();

    return territories.map((t) => this.toTerritoryResponse(t));
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

  private toTerritoryResponse(territory: Territory) {
    return {
      id: territory.id,
      userId: territory.user_id,
      coordinates: territory.coordinates,
      areaSqm: territory.area_sqm,
      occupationRate: territory.occupation_rate,
      lastActiveAt: territory.last_active_at,
    };
  }
}
