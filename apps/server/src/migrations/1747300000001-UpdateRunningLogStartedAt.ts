import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateRunningLogStartedAt1747300000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE running_log
      MODIFY COLUMN started_at DATETIME(6) NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE running_log
      MODIFY COLUMN started_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
    `);
  }
}
