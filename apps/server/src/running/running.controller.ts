import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RunningService } from './running.service';
import { FinishRunningDto } from './dto/finish-running.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('running')
export class RunningController {
  constructor(private readonly runningService: RunningService) {}

  @UseGuards(JwtAuthGuard)
  @Get('logs')
  findMine(@CurrentUser() user: User) {
    return this.runningService.findMine(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('finish')
  finish(@CurrentUser() user: User, @Body() dto: FinishRunningDto) {
    return this.runningService.finish(user.id, dto);
  }
}
