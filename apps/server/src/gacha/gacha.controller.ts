import { Controller, Post, UseGuards } from '@nestjs/common';
import { GachaService } from './gacha.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('gacha')
export class GachaController {
  constructor(private readonly gachaService: GachaService) {}

  @UseGuards(JwtAuthGuard)
  @Post('draw')
  draw(@CurrentUser() user: User) {
    void user;

    return this.gachaService.draw();
  }
}
