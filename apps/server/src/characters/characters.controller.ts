import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CharactersService } from './characters.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UpgradeCharacterDto } from './dto/upgrade-character.dto';
import { DeployCharacterDto } from './dto/deploy-character.dto';

@Controller('characters')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  findMine(@CurrentUser() user: User) {
    return this.charactersService.findMine(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/upgrade')
  upgrade(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpgradeCharacterDto,
  ) {
    return this.charactersService.upgrade(user.id, id, dto.stat);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/deploy')
  deploy(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeployCharacterDto,
  ) {
    return this.charactersService.deploy(user.id, id, dto.territory_id);
  }
}
