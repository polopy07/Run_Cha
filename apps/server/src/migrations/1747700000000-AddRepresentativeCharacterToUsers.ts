import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRepresentativeCharacterToUsers1747700000000 implements MigrationInterface {
  name = 'AddRepresentativeCharacterToUsers1747700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN representative_character_id INT NULL DEFAULT NULL,
        ADD CONSTRAINT fk_users_representative
          FOREIGN KEY (representative_character_id)
          REFERENCES user_characters(id)
          ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP FOREIGN KEY fk_users_representative
    `);
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN representative_character_id
    `);
  }
}
