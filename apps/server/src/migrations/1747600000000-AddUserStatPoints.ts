import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserStatPoints1747600000000 implements MigrationInterface {
  name = 'AddUserStatPoints1747600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN stat_points INT NOT NULL DEFAULT 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN stat_points`);
  }
}
