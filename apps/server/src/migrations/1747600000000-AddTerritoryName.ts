import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTerritoryName1747600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE territories ADD COLUMN name VARCHAR(100) NULL DEFAULT NULL AFTER user_id`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE territories DROP COLUMN name`);
  }
}
