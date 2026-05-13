import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSeasonTables1747100000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE seasons (
        id         INT         NOT NULL AUTO_INCREMENT,
        name       VARCHAR(50) NOT NULL,
        started_at DATETIME(6) NOT NULL,
        ended_at   DATETIME(6) NOT NULL,
        is_active  TINYINT     NOT NULL DEFAULT 0,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE season_rankings (
        id            INT         NOT NULL AUTO_INCREMENT,
        season_id     INT         NOT NULL,
        user_id       INT         NOT NULL,
        area_rank     INT         NULL,
        distance_rank INT         NULL,
        snapshot_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
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
