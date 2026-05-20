import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexes1746921700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE user_characters
        ADD INDEX IDX_user_characters_deployed_territory (deployed_territory_id);
    `);

    await queryRunner.query(`
      ALTER TABLE running_log
        ADD INDEX IDX_running_log_user_time (user_id, started_at);
    `);

    await queryRunner.query(`
      ALTER TABLE gacha_log
        ADD INDEX IDX_gacha_log_user_time (user_id, created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE user_characters DROP INDEX IDX_user_characters_deployed_territory`,
    );
    await queryRunner.query(
      `ALTER TABLE running_log DROP INDEX IDX_running_log_user_time`,
    );
    await queryRunner.query(
      `ALTER TABLE gacha_log DROP INDEX IDX_gacha_log_user_time`,
    );
  }
}
