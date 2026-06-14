import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Territory } from '../territories/entities/territory.entity';
import {
  DEFENSE_DECAY_GRACE_LEVEL_STEP,
  MAX_DEFENSE_DECAY_GRACE_DAYS,
  TERRITORY_DECAY_TIERS,
} from './territory-decay.constants';

// Keep this SQL formula in sync with calculateDefenseDecayGraceDays().
const DEFENSE_DECAY_GRACE_DAYS_SQL = `
  LEAST(
    FLOOR(
      GREATEST(
        COALESCE((
          SELECT MAX(uc.defense_lv)
          FROM user_characters uc
          INNER JOIN characters c ON c.id = uc.character_id
          WHERE uc.deployed_territory_id = territories.id
            AND c.type = 'defense'
        ), 1) - 1,
        0
      ) / :defenseDecayGraceLevelStep
    ),
    :maxDefenseDecayGraceDays
  )
`;

function inactiveBoundary(daysParam: string) {
  return `DATE_SUB(:now, INTERVAL (:${daysParam} + ${DEFENSE_DECAY_GRACE_DAYS_SQL}) DAY)`;
}

function decayGraceParameters(now: Date) {
  return {
    now,
    defenseDecayGraceLevelStep: DEFENSE_DECAY_GRACE_LEVEL_STEP,
    maxDefenseDecayGraceDays: MAX_DEFENSE_DECAY_GRACE_DAYS,
  };
}

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
        const longerInactiveTier = TERRITORY_DECAY_TIERS[index - 1];

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
          .andWhere(`last_active_at <= ${inactiveBoundary('inactiveDays')}`, {
            inactiveDays: tier.inactiveDays,
          })
          .setParameters(decayGraceParameters(now));

        if (longerInactiveTier) {
          query.andWhere(
            `last_active_at > ${inactiveBoundary('previousInactiveDays')}`,
            {
              previousInactiveDays: longerInactiveTier.inactiveDays,
            },
          );
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
