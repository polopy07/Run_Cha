import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttackLogsTable1747200000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE attack_logs (
        id                      INT          NOT NULL AUTO_INCREMENT,
        attacker_id             INT          NOT NULL,
        defender_id             INT          NOT NULL,
        territory_id            INT          NOT NULL,
        attacker_character_id   INT          NOT NULL,
        defender_character_id   INT          NULL,
        result                  ENUM('attacker_win', 'defender_win') NOT NULL,
        occupation_rate_before  INT          NOT NULL,
        occupation_rate_after   INT          NOT NULL,
        created_at              DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        INDEX IDX_attack_logs_attacker (attacker_id),
        INDEX IDX_attack_logs_defender (defender_id),
        INDEX IDX_attack_logs_territory (territory_id),
        CONSTRAINT FK_attack_logs_attacker
          FOREIGN KEY (attacker_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT FK_attack_logs_defender
          FOREIGN KEY (defender_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT FK_attack_logs_territory
          FOREIGN KEY (territory_id) REFERENCES territories (id) ON DELETE CASCADE,
        CONSTRAINT FK_attack_logs_attacker_character
          FOREIGN KEY (attacker_character_id) REFERENCES user_characters (id) ON DELETE CASCADE,
        CONSTRAINT FK_attack_logs_defender_character
          FOREIGN KEY (defender_character_id) REFERENCES user_characters (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE attack_logs`);
  }
}
