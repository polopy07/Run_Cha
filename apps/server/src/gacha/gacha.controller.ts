import { Controller, Post } from '@nestjs/common';
import { GachaService } from './gacha.service';

@Controller('gacha')
export class GachaController {
  constructor(private readonly gachaService: GachaService) {}

  @Post('draw')
  draw() {
    return this.gachaService.draw();
  }
}
