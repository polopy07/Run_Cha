import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateCharacterTypeAndSeedData1747300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE characters
      SET type = 'buff'
      WHERE type = 'territory'
    `);
    await queryRunner.query(`
      ALTER TABLE characters
      MODIFY COLUMN type ENUM('attack','defense','buff') NOT NULL
    `);

    await queryRunner.query(`
      UPDATE characters
      SET name = CASE
        WHEN grade = 'common' AND type = 'attack' THEN '공격형1'
        WHEN grade = 'common' AND type = 'defense' THEN '수비형1'
        WHEN grade = 'common' AND type = 'buff' THEN '버프형1'
        WHEN grade = 'rare' AND type = 'attack' THEN '공격형2'
        WHEN grade = 'rare' AND type = 'defense' THEN '수비형2'
        WHEN grade = 'rare' AND type = 'buff' THEN '버프형2'
        WHEN grade = 'epic' AND type = 'attack' THEN '공격형3'
        WHEN grade = 'epic' AND type = 'defense' THEN '수비형3'
        WHEN grade = 'epic' AND type = 'buff' THEN '버프형3'
        WHEN grade = 'legendary' AND type = 'attack' THEN '공격형4'
        WHEN grade = 'legendary' AND type = 'defense' THEN '수비형4'
        WHEN grade = 'legendary' AND type = 'buff' THEN '버프형4'
        ELSE name
      END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE characters
      MODIFY COLUMN type ENUM('attack','defense','territory','buff') NOT NULL
    `);
  }
}
