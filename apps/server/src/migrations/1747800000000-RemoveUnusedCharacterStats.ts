import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveUnusedCharacterStats1747800000000 implements MigrationInterface {
  name = 'RemoveUnusedCharacterStats1747800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const userCharacters = await queryRunner.getTable('user_characters');
    const characters = await queryRunner.getTable('characters');

    if (userCharacters?.findColumnByName('speed_lv')) {
      await queryRunner.query(
        `ALTER TABLE user_characters DROP COLUMN speed_lv`,
      );
    }

    if (characters?.findColumnByName('base_speed')) {
      await queryRunner.query(`ALTER TABLE characters DROP COLUMN base_speed`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const characters = await queryRunner.getTable('characters');
    const userCharacters = await queryRunner.getTable('user_characters');

    if (!characters?.findColumnByName('base_speed')) {
      await queryRunner.query(
        `ALTER TABLE characters ADD COLUMN base_speed FLOAT NOT NULL DEFAULT 10`,
      );
    }

    if (!userCharacters?.findColumnByName('speed_lv')) {
      await queryRunner.query(
        `ALTER TABLE user_characters ADD COLUMN speed_lv INT NOT NULL DEFAULT 1`,
      );
    }
  }
}
