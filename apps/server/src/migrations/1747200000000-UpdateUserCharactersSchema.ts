import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateUserCharactersSchema1747200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE user_characters DROP INDEX IDX_user_characters_user_deployed`,
    );

    await queryRunner.query(
      `ALTER TABLE user_characters DROP COLUMN is_deployed`,
    );

    await queryRunner.query(`
      ALTER TABLE user_characters
        ADD COLUMN deployed_territory_id INT NULL,
        ADD CONSTRAINT FK_user_characters_territory
          FOREIGN KEY (deployed_territory_id) REFERENCES territories (id)
          ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE user_characters DROP FOREIGN KEY FK_user_characters_territory`,
    );

    await queryRunner.query(
      `ALTER TABLE user_characters DROP COLUMN deployed_territory_id`,
    );

    await queryRunner.query(`
      ALTER TABLE user_characters
        ADD COLUMN is_deployed TINYINT NOT NULL DEFAULT 0,
        ADD INDEX IDX_user_characters_user_deployed (user_id, is_deployed)
    `);
  }
}
