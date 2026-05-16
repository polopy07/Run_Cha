import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPityCountAndDistanceIndex1747100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN pity_count INT NOT NULL DEFAULT 0;
    `);

    await queryRunner.query(`
      ALTER TABLE users
        ADD INDEX IDX_users_total_distance (total_distance);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE users DROP INDEX IDX_users_total_distance`,
    );
    await queryRunner.query(`ALTER TABLE users DROP COLUMN pity_count`);
  }
}
