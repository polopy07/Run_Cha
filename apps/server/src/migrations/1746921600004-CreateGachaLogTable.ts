import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGachaLogTable1746921600004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE gacha_log (
        id                  INT         NOT NULL AUTO_INCREMENT,
        user_id             INT         NOT NULL,
        result_character_id INT         NOT NULL,
        is_guaranteed       TINYINT     NOT NULL DEFAULT 0,
        pity_count          INT         NOT NULL DEFAULT 0,
        created_at          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        CONSTRAINT FK_gacha_log_user      FOREIGN KEY (user_id)             REFERENCES users      (id) ON DELETE CASCADE,
        CONSTRAINT FK_gacha_log_character FOREIGN KEY (result_character_id) REFERENCES characters (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE gacha_log`);
  }
}
