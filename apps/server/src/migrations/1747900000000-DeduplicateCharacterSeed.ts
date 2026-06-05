import { MigrationInterface, QueryRunner } from 'typeorm';

type DuplicateCharacterSeedRow = {
  keep_id: number;
  duplicate_ids: string;
};

export class DeduplicateCharacterSeed1747900000000 implements MigrationInterface {
  name = 'DeduplicateCharacterSeed1747900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

    try {
      const duplicates = (await queryRunner.query(`
        SELECT
          MIN(id) AS keep_id,
          GROUP_CONCAT(id ORDER BY id) AS duplicate_ids
        FROM characters
        GROUP BY grade, type, name
        HAVING COUNT(*) > 1
      `)) as DuplicateCharacterSeedRow[];

      for (const duplicate of duplicates) {
        const ids = duplicate.duplicate_ids
          .split(',')
          .map((id) => Number(id))
          .filter((id) => id !== duplicate.keep_id);

        if (ids.length === 0) continue;

        await queryRunner.query(
          `UPDATE user_characters SET character_id = ? WHERE character_id IN (?)`,
          [duplicate.keep_id, ids],
        );
        await queryRunner.query(
          `UPDATE gacha_log SET result_character_id = ? WHERE result_character_id IN (?)`,
          [duplicate.keep_id, ids],
        );
        await queryRunner.query(`DELETE FROM characters WHERE id IN (?)`, [
          ids,
        ]);
      }
    } finally {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
    }
  }

  public async down(): Promise<void> {
    // Seed de-duplication cannot be safely reversed without recreating old IDs.
  }
}
