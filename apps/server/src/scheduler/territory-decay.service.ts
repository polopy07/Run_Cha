import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Territory } from '../territories/entities/territory.entity';
import { DAY_IN_MS, TERRITORY_DECAY_TIERS } from './territory-decay.constants';

@Injectable()
export class TerritoryDecayService {
  private readonly logger = new Logger(TerritoryDecayService.name);

  constructor(
    @InjectRepository(Territory)
    private readonly territoryRepo: Repository<Territory>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDecay() {
    this.logger.log('Territory decay started');
    const now = new Date();

    const [neutralizedResult, ...decayResults] = await Promise.all(
      TERRITORY_DECAY_TIERS.map((tier, index) => {
        const cutoff = new Date(now.getTime() - tier.inactiveDays * DAY_IN_MS);
        const nextTier = TERRITORY_DECAY_TIERS[index - 1];
        const previousCutoff = nextTier
          ? new Date(now.getTime() - nextTier.inactiveDays * DAY_IN_MS)
          : null;

        const query = this.territoryRepo
          .createQueryBuilder()
          .update()
          // Preserve last_active_at because UpdateDateColumn may refresh on UPDATE.
          .set({
            occupation_rate: tier.occupationRate,
            last_active_at: () => 'last_active_at',
          })
          .where('area_sqm > 0')
          .andWhere('occupation_rate > :occupationRate', {
            occupationRate: tier.occupationRate,
          })
          .andWhere('last_active_at <= :cutoff', { cutoff });

        if (previousCutoff) {
          query.andWhere('last_active_at > :previousCutoff', {
            previousCutoff,
          });
        }

        return query.execute();
      }),
    );

    const neutralized = neutralizedResult.affected ?? 0;
    const decayed = decayResults.reduce(
      (sum, result) => sum + (result.affected ?? 0),
      0,
    );

    this.logger.log(
      `Territory decay completed: ${decayed} decayed, ${neutralized} neutralized`,
    );
    return { decayed, neutralized };
  }
}
