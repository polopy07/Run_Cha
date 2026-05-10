import { Controller, Get, Query } from '@nestjs/common';
import { TerritoriesService } from './territories.service';
import { GetTerritoriesDto } from './dto/get-territories.dto';

@Controller('territories')
export class TerritoriesController {
  constructor(private readonly territoriesService: TerritoriesService) {}

  @Get()
  getInBounds(@Query() dto: GetTerritoriesDto) {
    return this.territoriesService.findInBounds(dto);
  }
}
