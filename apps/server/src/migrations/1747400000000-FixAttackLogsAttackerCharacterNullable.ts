import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixAttackLogsAttackerCharacterNullable1747400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE attack_logs DROP FOREIGN KEY FK_attack_logs_attacker_character`,
    );

    await queryRunner.query(
      `ALTER TABLE attack_logs MODIFY COLUMN attacker_character_id INT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE attack_logs ADD CONSTRAINT FK_attack_logs_attacker_character
        FOREIGN KEY (attacker_character_id) REFERENCES user_characters (id) ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE attack_logs DROP FOREIGN KEY FK_attack_logs_attacker_character`,
    );

    await queryRunner.query(
      `DELETE FROM attack_logs WHERE attacker_character_id IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE attack_logs MODIFY COLUMN attacker_character_id INT NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE attack_logs ADD CONSTRAINT FK_attack_logs_attacker_character
        FOREIGN KEY (attacker_character_id) REFERENCES user_characters (id) ON DELETE RESTRICT`,
    );
  }
}
