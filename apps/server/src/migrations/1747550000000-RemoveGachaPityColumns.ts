import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveGachaPityColumns1747550000000 implements MigrationInterface {
  name = 'RemoveGachaPityColumns1747550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('gacha_log', 'is_guaranteed')) {
      await queryRunner.query(
        `ALTER TABLE gacha_log DROP COLUMN is_guaranteed`,
      );
    }

    if (await queryRunner.hasColumn('gacha_log', 'pity_count')) {
      await queryRunner.query(`ALTER TABLE gacha_log DROP COLUMN pity_count`);
    }

    if (await queryRunner.hasColumn('users', 'pity_count')) {
      await queryRunner.query(`ALTER TABLE users DROP COLUMN pity_count`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('users', 'pity_count'))) {
      await queryRunner.query(
        `ALTER TABLE users ADD COLUMN pity_count INT NOT NULL DEFAULT 0`,
      );
    }

    if (!(await queryRunner.hasColumn('gacha_log', 'pity_count'))) {
      await queryRunner.query(
        `ALTER TABLE gacha_log ADD COLUMN pity_count INT NOT NULL DEFAULT 0`,
      );
    }

    if (!(await queryRunner.hasColumn('gacha_log', 'is_guaranteed'))) {
      await queryRunner.query(
        `ALTER TABLE gacha_log ADD COLUMN is_guaranteed TINYINT NOT NULL DEFAULT 0`,
      );
    }
  }
}
