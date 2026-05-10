import { Body, Controller, Post, Req } from '@nestjs/common';
import { RunningService } from './running.service';
import { FinishRunningDto } from './dto/finish-running.dto';

@Controller('running')
export class RunningController {
  constructor(private readonly runningService: RunningService) {}

  @Post('finish')
  finish(@Req() req: { user: { id: number } }, @Body() dto: FinishRunningDto) {
    return this.runningService.finish(req.user.id, dto);
  }
}
