import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAttackLogRunningLog1747500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE attack_logs ADD COLUMN running_log_id INT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE attack_logs ADD UNIQUE INDEX UQ_attack_logs_running_log (running_log_id)`,
    );

    await queryRunner.query(
      `ALTER TABLE attack_logs ADD CONSTRAINT FK_attack_logs_running_log
        FOREIGN KEY (running_log_id) REFERENCES running_log (id) ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE attack_logs DROP FOREIGN KEY FK_attack_logs_running_log`,
    );

    await queryRunner.query(
      `ALTER TABLE attack_logs DROP INDEX UQ_attack_logs_running_log`,
    );

    await queryRunner.query(
      `ALTER TABLE attack_logs DROP COLUMN running_log_id`,
    );
  }
}
