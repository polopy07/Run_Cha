import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { RankingService } from './ranking.service';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';

@Controller('ranking')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get('area')
  getAreaRanking(@Req() req: { user?: { id: number } }) {
    return this.rankingService.getAreaRanking(req.user?.id);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('distance')
  getDistanceRanking(@Req() req: { user?: { id: number } }) {
    return this.rankingService.getDistanceRanking(req.user?.id);
  }
}
