import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAreaSqmToRunningLog1747100000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE running_log
        ADD COLUMN area_sqm FLOAT NOT NULL DEFAULT 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE running_log DROP COLUMN area_sqm`);
  }
}
