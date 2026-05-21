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
    const cutoff3  = new Date(now.getTime() -  3 * 86_400_000);
    const cutoff7  = new Date(now.getTime() -  7 * 86_400_000);
    const cutoff14 = new Date(now.getTime() - 14 * 86_400_000);
    const cutoff21 = new Date(now.getTime() - 21 * 86_400_000);

    // last_active_at 구간별 배치 쿼리로 N+1 제거
    const [deleteResult, r25, r50, r75] = await Promise.all([
      this.territoryRepo
        .createQueryBuilder()
        .delete()
        .where('last_active_at <= :cutoff21', { cutoff21 })
        .execute(),
      this.territoryRepo
        .createQueryBuilder()
        .update()
        // last_active_at을 명시적으로 유지해야 ON UPDATE CURRENT_TIMESTAMP 자동 갱신 방지
        .set({ occupation_rate: 25, last_active_at: () => 'last_active_at' })
        .where(
          'last_active_at > :cutoff21 AND last_active_at <= :cutoff14 AND occupation_rate > 25',
          { cutoff21, cutoff14 },
        )
        .execute(),
      this.territoryRepo
        .createQueryBuilder()
        .update()
        .set({ occupation_rate: 50, last_active_at: () => 'last_active_at' })
        .where(
          'last_active_at > :cutoff14 AND last_active_at <= :cutoff7 AND occupation_rate > 50',
          { cutoff14, cutoff7 },
        )
        .execute(),
      this.territoryRepo
        .createQueryBuilder()
        .update()
        .set({ occupation_rate: 75, last_active_at: () => 'last_active_at' })
        .where(
          'last_active_at > :cutoff7 AND last_active_at <= :cutoff3 AND occupation_rate > 75',
          { cutoff7, cutoff3 },
        )
        .execute(),
    ]);

    const neutralized = deleteResult.affected ?? 0;
    const decayed = (r25.affected ?? 0) + (r50.affected ?? 0) + (r75.affected ?? 0);

    this.logger.log(`완료: ${decayed}개 감소, ${neutralized}개 중립화(삭제)`);
    return { decayed, neutralized };
  }
}
