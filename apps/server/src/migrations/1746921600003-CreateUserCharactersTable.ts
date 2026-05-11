import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserCharactersTable1746921600003
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_characters (
        id           INT     NOT NULL AUTO_INCREMENT,
        user_id      INT     NOT NULL,
        character_id INT     NOT NULL,
        attack_lv    INT     NOT NULL DEFAULT 1,
        defense_lv   INT     NOT NULL DEFAULT 1,
        speed_lv     INT     NOT NULL DEFAULT 1,
        point_lv     INT     NOT NULL DEFAULT 1,
        is_deployed  TINYINT NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        CONSTRAINT FK_user_characters_user      FOREIGN KEY (user_id)      REFERENCES users      (id) ON DELETE CASCADE,
        CONSTRAINT FK_user_characters_character FOREIGN KEY (character_id) REFERENCES characters (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE user_characters`);
  }
}
