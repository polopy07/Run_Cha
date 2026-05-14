import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Territory } from '../territories/entities/territory.entity';

@Injectable()
export class TerritoryDecayService {
  private readonly logger = new Logger(TerritoryDecayService.name);

  constructor(
    @InjectRepository(Territory)
    private readonly territoryRepo: Repository<Territory>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDecay() {
    this.logger.log('땅 자연 감소 배치 시작');
    const now = new Date();
    const territories = await this.territoryRepo.find();

    let decayed = 0;
    let neutralized = 0;

    for (const territory of territories) {
      const days = Math.floor(
        (now.getTime() - territory.last_active_at.getTime()) / 86_400_000,
      );
      const newRate = this.calcOccupationRate(days);

      if (newRate === 0) {
        await this.territoryRepo.delete(territory.id);
        neutralized++;
      } else if (newRate < territory.occupation_rate) {
        // last_active_at을 명시적으로 유지해야 ON UPDATE CURRENT_TIMESTAMP 자동 갱신 방지
        await this.territoryRepo
          .createQueryBuilder()
          .update()
          .set({ occupation_rate: newRate, last_active_at: () => 'last_active_at' })
          .where('id = :id', { id: territory.id })
          .execute();
        decayed++;
      }
    }

    this.logger.log(`완료: ${decayed}개 감소, ${neutralized}개 중립화(삭제)`);
    return { decayed, neutralized };
  }

  private calcOccupationRate(daysSinceActive: number): number {
    if (daysSinceActive <= 3) return 100;
    if (daysSinceActive <= 7) return 75;
    if (daysSinceActive <= 14) return 50;
    if (daysSinceActive <= 21) return 25;
    return 0;
  }
}
