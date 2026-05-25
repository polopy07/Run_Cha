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
    const cutoff4  = new Date(now.getTime() -  4 * 86_400_000);
    const cutoff8  = new Date(now.getTime() -  8 * 86_400_000);
    const cutoff15 = new Date(now.getTime() - 15 * 86_400_000);
    const cutoff22 = new Date(now.getTime() - 22 * 86_400_000);

    // last_active_at 구간별 배치 쿼리로 N+1 제거
    const [deleteResult, r25, r50, r75] = await Promise.all([
      this.territoryRepo
        .createQueryBuilder()
        .delete()
        .where('last_active_at <= :cutoff22', { cutoff22 })
        .execute(),
      this.territoryRepo
        .createQueryBuilder()
        .update()
        // last_active_at을 명시적으로 유지해야 ON UPDATE CURRENT_TIMESTAMP 자동 갱신 방지
        .set({ occupation_rate: 25, last_active_at: () => 'last_active_at' })
        .where(
          'last_active_at <= :cutoff15 AND last_active_at > :cutoff22 AND occupation_rate > 25',
          { cutoff15, cutoff22 },
        )
        .execute(),
      this.territoryRepo
        .createQueryBuilder()
        .update()
        .set({ occupation_rate: 50, last_active_at: () => 'last_active_at' })
        .where(
          'last_active_at <= :cutoff8 AND last_active_at > :cutoff15 AND occupation_rate > 50',
          { cutoff8, cutoff15 },
        )
        .execute(),
      this.territoryRepo
        .createQueryBuilder()
        .update()
        .set({ occupation_rate: 75, last_active_at: () => 'last_active_at' })
        .where(
          'last_active_at <= :cutoff4 AND last_active_at > :cutoff8 AND occupation_rate > 75',
          { cutoff4, cutoff8 },
        )
        .execute(),
    ]);

    const neutralized = deleteResult.affected ?? 0;
    const decayed = (r25.affected ?? 0) + (r50.affected ?? 0) + (r75.affected ?? 0);

    this.logger.log(`완료: ${decayed}개 감소, ${neutralized}개 중립화(삭제)`);
    return { decayed, neutralized };
  }
}
