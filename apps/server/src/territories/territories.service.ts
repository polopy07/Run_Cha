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

  async findInBounds(dto: GetTerritoriesDto): Promise<Territory[]> {
    const { minLat, maxLat, minLng, maxLng } = dto;

    // coordinates는 JSON 배열이므로 MySQL에서 bounding box 필터링 불가
    // 전체를 가져온 뒤 첫 번째 좌표 기준으로 필터링
    const territories = await this.territoryRepo.find({
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

    return territories.filter((t) => {
      if (!t.coordinates?.length) return false;
      const { lat, lng } = t.coordinates[0];
      return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
    });
  }

  async registerTerritory(
    userId: number,
    coordinates: { lat: number; lng: number }[],
    areaSqm: number,
  ): Promise<Territory> {
    const territory = this.territoryRepo.create({
      user_id: userId,
      coordinates,
      area_sqm: areaSqm,
      occupation_rate: 100,
    });
    return this.territoryRepo.save(territory);
  }
}
