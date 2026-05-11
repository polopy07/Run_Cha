import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCharactersTable1746921600002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE characters (
        id               INT         NOT NULL AUTO_INCREMENT,
        name             VARCHAR(50) NOT NULL,
        type             ENUM('attack','defense','territory','buff') NOT NULL,
        grade            ENUM('common','rare','epic','legendary')    NOT NULL,
        base_attack      FLOAT       NOT NULL DEFAULT 10,
        base_defense     FLOAT       NOT NULL DEFAULT 10,
        base_speed       FLOAT       NOT NULL DEFAULT 10,
        base_point_rate  FLOAT       NOT NULL DEFAULT 1.0,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE characters`);
  }
}
