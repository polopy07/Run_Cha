import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

const SQM_PER_POINT = 1000;

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
            user_id,
            FLOOR(SUM(area_sqm * occupation_rate / 100) / ?) AS points
          FROM territories
          WHERE occupation_rate > 0
          GROUP BY user_id
          HAVING points > 0
        ) AS income ON u.id = income.user_id
        SET u.points = u.points + income.points
      `,
      [SQM_PER_POINT],
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
