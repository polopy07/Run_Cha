import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Territory } from './entities/territory.entity';
import { GetTerritoriesDto } from './dto/get-territories.dto';

@Injectable()
export class TerritoriesService {
  constructor(
    @InjectRepository(Territory)
    private readonly territoryRepo: Repository<Territory>,
  ) {}

  async findInBounds(dto: GetTerritoriesDto) {
    const { minLat, maxLat, minLng, maxLng } = dto;

    const territories = await this.territoryRepo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.user', 'u')
      .where('t.center_lat BETWEEN :minLat AND :maxLat', { minLat, maxLat })
      .andWhere('t.center_lng BETWEEN :minLng AND :maxLng', { minLng, maxLng })
      .getMany();

    return territories.map((t) => ({
      id: t.id,
      userId: t.user_id,
      coordinates: t.coordinates,
      areaSqm: t.area_sqm,
      occupationRate: t.occupation_rate,
    }));
  }

  async registerTerritory(
    userId: number,
    coordinates: { lat: number; lng: number }[],
    areaSqm: number,
  ): Promise<Territory> {
    const center = this.calcCenter(coordinates);
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

  private calcCenter(
    coordinates: { lat: number; lng: number }[],
  ): { lat: number; lng: number } {
    const lat = coordinates.reduce((sum, p) => sum + p.lat, 0) / coordinates.length;
    const lng = coordinates.reduce((sum, p) => sum + p.lng, 0) / coordinates.length;
    return { lat, lng };
  }
}
