import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AttackTerritoryDto } from './dto/attack-territory.dto';
import { AttacksService } from './attacks.service';

@Controller('territories')
export class AttacksController {
  constructor(private readonly attacksService: AttacksService) {}

  @UseGuards(JwtAuthGuard)
  @Post(':id/attack')
  attack(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) territoryId: number,
    @Body() dto: AttackTerritoryDto,
  ) {
    return this.attacksService.attack(user.id, territoryId, dto);
  }
}
