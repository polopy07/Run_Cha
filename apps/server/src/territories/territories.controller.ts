import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TerritoriesService } from './territories.service';
import { GetTerritoriesDto } from './dto/get-territories.dto';
import { UpdateTerritoryNameDto } from './dto/update-territory-name.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('territories')
export class TerritoriesController {
  constructor(private readonly territoriesService: TerritoriesService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  findMine(@CurrentUser() user: User) {
    return this.territoriesService.findMine(user.id);
  }

  @Get()
  getInBounds(@Query() dto: GetTerritoriesDto) {
    return this.territoriesService.findInBounds(dto);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  findOne(
    @CurrentUser() user: User | undefined,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.territoriesService.findOne(id, user?.id ?? null);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/name')
  updateName(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTerritoryNameDto,
  ) {
    return this.territoriesService.updateName(id, user.id, dto.name ?? null);
  }
}
