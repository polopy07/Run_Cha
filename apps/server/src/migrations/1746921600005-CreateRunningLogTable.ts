import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRunningLogTable1746921600005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE running_log (
        id             INT         NOT NULL AUTO_INCREMENT,
        user_id        INT         NOT NULL,
        path           JSON        NOT NULL,
        distance_km    FLOAT       NOT NULL,
        earned_points  INT         NOT NULL DEFAULT 0,
        avg_pace       FLOAT       NOT NULL,
        started_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        ended_at       DATETIME    NULL,
        PRIMARY KEY (id),
        CONSTRAINT FK_running_log_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE running_log`);
  }
}
