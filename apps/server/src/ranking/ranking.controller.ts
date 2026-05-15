import { Controller, Get, Req } from '@nestjs/common';
import { RankingService } from './ranking.service';

@Controller('ranking')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get('area')
  getAreaRanking(@Req() req: { user?: { id: number } }) {
    return this.rankingService.getAreaRanking(req.user?.id);
  }

  @Get('distance')
  getDistanceRanking(@Req() req: { user?: { id: number } }) {
    return this.rankingService.getDistanceRanking(req.user?.id);
  }
}
