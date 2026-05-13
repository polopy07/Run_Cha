import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSeasonTables1747100000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE seasons (
        id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
        name       VARCHAR(50)  NOT NULL,
        started_at DATETIME     NOT NULL,
        ended_at   DATETIME     NOT NULL,
        is_active  TINYINT(1)   NOT NULL DEFAULT 0,
        created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX IDX_seasons_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE season_rankings (
        id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
        season_id     INT UNSIGNED NOT NULL,
        user_id       INT          NOT NULL,
        area_rank     INT UNSIGNED NOT NULL DEFAULT 0,
        distance_rank INT UNSIGNED NOT NULL DEFAULT 0,
        snapshot_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        CONSTRAINT FK_season_rankings_season FOREIGN KEY (season_id) REFERENCES seasons (id) ON DELETE CASCADE,
        CONSTRAINT FK_season_rankings_user   FOREIGN KEY (user_id)   REFERENCES users   (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE season_rankings`);
    await queryRunner.query(`DROP TABLE seasons`);
  }
}
