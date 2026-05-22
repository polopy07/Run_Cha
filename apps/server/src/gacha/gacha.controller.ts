import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GachaService } from './gacha.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { DrawGachaDto } from './dto/draw-gacha.dto';

@Controller('gacha')
export class GachaController {
  constructor(private readonly gachaService: GachaService) {}

  @UseGuards(JwtAuthGuard)
  @Post('draw')
  draw(@CurrentUser() user: User, @Body() dto: DrawGachaDto) {
    return this.gachaService.draw(user.id, dto.count);
  }
}
