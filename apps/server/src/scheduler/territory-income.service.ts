import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

// Keep in sync with apps/mobile/src/utils/territoryIncomeUtils.ts.
const SQM_PER_POINT = 1000;
const POINT_EFFICIENCY_LEVEL_BONUS = 0.05;
const POINT_EFFICIENCY_MULTIPLIER_CAP = 2;

type TerritoryIncomeResult = {
  affectedRows?: number;
  changedRows?: number;
};

@Injectable()
export class TerritoryIncomeService {
  private readonly logger = new Logger(TerritoryIncomeService.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyIncome() {
    this.logger.log('Territory hourly income started');

    const result = await this.dataSource.query<TerritoryIncomeResult>(
      `
        UPDATE users u
        INNER JOIN (
          SELECT
            t.user_id,
            FLOOR(
              SUM(
                (t.area_sqm * t.occupation_rate / 100 / ?) *
                CASE
                  WHEN c.type = 'buff' THEN LEAST(
                    COALESCE(c.base_point_rate, 1) +
                      GREATEST(COALESCE(uc.point_lv, 1) - 1, 0) * ?,
                    ?
                  )
                  ELSE 1
                END
              )
            ) AS points
          FROM territories t
          LEFT JOIN user_characters uc ON uc.deployed_territory_id = t.id
          LEFT JOIN characters c ON c.id = uc.character_id
          WHERE t.occupation_rate > 0
          GROUP BY t.user_id
          HAVING points > 0
        ) AS income ON u.id = income.user_id
        SET u.points = u.points + income.points
      `,
      [
        SQM_PER_POINT,
        POINT_EFFICIENCY_LEVEL_BONUS,
        POINT_EFFICIENCY_MULTIPLIER_CAP,
      ],
    );

    const affectedRows = Number(result?.affectedRows ?? 0);
    const changedRows = Number(result?.changedRows ?? affectedRows);

    if (affectedRows === 0) {
      this.logger.log('Territory hourly income skipped: no recipients');
    } else {
      this.logger.log(
        `Territory hourly income completed: ${affectedRows} recipients updated`,
      );
    }

    return { affectedRows, changedRows };
  }
}
