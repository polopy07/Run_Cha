import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1746921600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id           INT          NOT NULL AUTO_INCREMENT,
        firebase_uid VARCHAR(128) NOT NULL,
        nickname     VARCHAR(50)  NOT NULL,
        email        VARCHAR(255) NOT NULL,
        points       INT          NOT NULL DEFAULT 0,
        total_distance FLOAT      NOT NULL DEFAULT 0,
        created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE KEY UQ_users_firebase_uid (firebase_uid),
        UNIQUE KEY UQ_users_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE users`);
  }
}
