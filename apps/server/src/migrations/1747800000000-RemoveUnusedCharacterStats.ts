import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveUnusedCharacterStats1747800000000
  implements MigrationInterface
{
  name = 'RemoveUnusedCharacterStats1747800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE user_characters DROP COLUMN point_lv`,
    );
    await queryRunner.query(
      `ALTER TABLE user_characters DROP COLUMN speed_lv`,
    );
    await queryRunner.query(
      `ALTER TABLE characters DROP COLUMN base_point_rate`,
    );
    await queryRunner.query(`ALTER TABLE characters DROP COLUMN base_speed`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE characters ADD COLUMN base_speed FLOAT NOT NULL DEFAULT 10`,
    );
    await queryRunner.query(
      `ALTER TABLE characters ADD COLUMN base_point_rate FLOAT NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE user_characters ADD COLUMN speed_lv INT NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE user_characters ADD COLUMN point_lv INT NOT NULL DEFAULT 1`,
    );
  }
}
