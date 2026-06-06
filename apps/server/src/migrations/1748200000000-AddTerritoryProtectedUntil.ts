import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTerritoryProtectedUntil1748200000000 implements MigrationInterface {
  name = 'AddTerritoryProtectedUntil1748200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasProtectedUntil = await queryRunner.hasColumn(
      'territories',
      'protected_until',
    );

    if (!hasProtectedUntil) {
      await queryRunner.query(
        'ALTER TABLE `territories` ADD `protected_until` datetime NULL DEFAULT NULL',
      );
      await queryRunner.query(
        'CREATE INDEX `IDX_territories_protected_until` ON `territories` (`protected_until`)',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasProtectedUntil = await queryRunner.hasColumn(
      'territories',
      'protected_until',
    );

    if (hasProtectedUntil) {
      await queryRunner.query(
        'DROP INDEX `IDX_territories_protected_until` ON `territories`',
      );
      await queryRunner.query(
        'ALTER TABLE `territories` DROP COLUMN `protected_until`',
      );
    }
  }
}
