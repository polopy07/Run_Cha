import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserCharacterLevelExperience1748100000000 implements MigrationInterface {
  name = 'AddUserCharacterLevelExperience1748100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasLevel = await queryRunner.hasColumn('user_characters', 'level');
    if (!hasLevel) {
      await queryRunner.query(
        'ALTER TABLE `user_characters` ADD `level` int NOT NULL DEFAULT 1',
      );
    }

    const hasExperience = await queryRunner.hasColumn(
      'user_characters',
      'experience',
    );
    if (!hasExperience) {
      await queryRunner.query(
        'ALTER TABLE `user_characters` ADD `experience` int NOT NULL DEFAULT 0',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasExperience = await queryRunner.hasColumn(
      'user_characters',
      'experience',
    );
    if (hasExperience) {
      await queryRunner.query(
        'ALTER TABLE `user_characters` DROP COLUMN `experience`',
      );
    }

    const hasLevel = await queryRunner.hasColumn('user_characters', 'level');
    if (hasLevel) {
      await queryRunner.query(
        'ALTER TABLE `user_characters` DROP COLUMN `level`',
      );
    }
  }
}
