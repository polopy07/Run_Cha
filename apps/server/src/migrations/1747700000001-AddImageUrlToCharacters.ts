import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageUrlToCharacters1747700000001 implements MigrationInterface {
  name = 'AddImageUrlToCharacters1747700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE characters
        ADD COLUMN image_url VARCHAR(500) NULL DEFAULT NULL
    `);
    await queryRunner.query(`
      UPDATE characters
        SET image_url = CONCAT(LOWER(type), '_', LOWER(grade))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE characters
        DROP COLUMN image_url
    `);
  }
}
