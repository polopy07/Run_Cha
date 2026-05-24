import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';

const SQM_PER_POINT = 1000;

type TerritoryIncomeRow = {
  userId: number | string;
  points: number | string;
};

@Injectable()
export class TerritoryIncomeService {
  private readonly logger = new Logger(TerritoryIncomeService.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyIncome() {
    this.logger.log('Territory hourly income started');

    const incomeRows = await this.dataSource.query<TerritoryIncomeRow[]>(
      `
        SELECT
          user_id AS userId,
          FLOOR(SUM(area_sqm * occupation_rate / 100) / ?) AS points
        FROM territories
        WHERE occupation_rate > 0
        GROUP BY user_id
        HAVING points > 0
      `,
      [SQM_PER_POINT],
    );

    if (incomeRows.length === 0) {
      this.logger.log('Territory hourly income skipped: no recipients');
      return { recipients: 0, totalPoints: 0 };
    }

    await this.dataSource.transaction(async (manager) => {
      for (const row of incomeRows) {
        await manager.increment(
          User,
          { id: Number(row.userId) },
          'points',
          Number(row.points),
        );
      }
    });

    const totalPoints = incomeRows.reduce(
      (sum, row) => sum + Number(row.points),
      0,
    );

    this.logger.log(
      `Territory hourly income completed: ${incomeRows.length} recipients, ${totalPoints} points`,
    );

    return { recipients: incomeRows.length, totalPoints };
  }
}
