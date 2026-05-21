import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTerritoriesIndexes1747200000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE territories
        ADD INDEX IDX_territories_occupation_rate (occupation_rate);
    `);

    await queryRunner.query(`
      ALTER TABLE territories
        ADD INDEX IDX_territories_last_active_at (last_active_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE territories DROP INDEX IDX_territories_occupation_rate`,
    );
    await queryRunner.query(
      `ALTER TABLE territories DROP INDEX IDX_territories_last_active_at`,
    );
  }
}
