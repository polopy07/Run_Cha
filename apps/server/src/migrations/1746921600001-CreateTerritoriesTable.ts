import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTerritoriesTable1746921600001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE territories (
        id               INT         NOT NULL AUTO_INCREMENT,
        user_id          INT         NOT NULL,
        coordinates      JSON        NOT NULL,
        area_sqm         FLOAT       NOT NULL,
        occupation_rate  INT         NOT NULL DEFAULT 100,
        last_active_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        CONSTRAINT FK_territories_user FOREIGN KEY (user_id)
          REFERENCES users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE territories`);
  }
}
