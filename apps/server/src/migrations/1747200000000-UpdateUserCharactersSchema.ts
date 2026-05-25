import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateUserCharactersSchema1747200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const userCharactersTable = await queryRunner.getTable('user_characters');
    const hasUserIndex = userCharactersTable?.indices.some(
      (index) => index.name === 'IDX_user_characters_user',
    );
    const hasUserDeployedIndex = userCharactersTable?.indices.some(
      (index) => index.name === 'IDX_user_characters_user_deployed',
    );
    const hasDeployedTerritoryIndex = userCharactersTable?.indices.some(
      (index) => index.name === 'IDX_user_characters_deployed_territory',
    );
    const hasIsDeployedColumn = userCharactersTable?.columns.some(
      (column) => column.name === 'is_deployed',
    );
    const hasDeployedTerritoryColumn = userCharactersTable?.columns.some(
      (column) => column.name === 'deployed_territory_id',
    );
    const hasDeployedTerritoryFk = userCharactersTable?.foreignKeys.some(
      (foreignKey) => foreignKey.name === 'FK_user_characters_territory',
    );

    if (!hasUserIndex) {
      await queryRunner.query(
        `ALTER TABLE user_characters ADD INDEX IDX_user_characters_user (user_id)`,
      );
    }

    if (hasUserDeployedIndex) {
      await queryRunner.query(
        `ALTER TABLE user_characters DROP INDEX IDX_user_characters_user_deployed`,
      );
    }

    if (hasIsDeployedColumn) {
      await queryRunner.query(
        `ALTER TABLE user_characters DROP COLUMN is_deployed`,
      );
    }

    if (!hasDeployedTerritoryColumn) {
      await queryRunner.query(
        `ALTER TABLE user_characters ADD COLUMN deployed_territory_id INT NULL`,
      );
    }

    if (!hasDeployedTerritoryIndex) {
      await queryRunner.query(
        `ALTER TABLE user_characters ADD INDEX IDX_user_characters_deployed_territory (deployed_territory_id)`,
      );
    }

    if (!hasDeployedTerritoryFk) {
      await queryRunner.query(`
        ALTER TABLE user_characters
          ADD CONSTRAINT FK_user_characters_territory
            FOREIGN KEY (deployed_territory_id) REFERENCES territories (id)
            ON DELETE SET NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const userCharactersTable = await queryRunner.getTable('user_characters');
    const hasDeployedTerritoryFk = userCharactersTable?.foreignKeys.some(
      (foreignKey) => foreignKey.name === 'FK_user_characters_territory',
    );
    const hasDeployedTerritoryIndex = userCharactersTable?.indices.some(
      (index) => index.name === 'IDX_user_characters_deployed_territory',
    );
    const hasDeployedTerritoryColumn = userCharactersTable?.columns.some(
      (column) => column.name === 'deployed_territory_id',
    );
    const hasIsDeployedColumn = userCharactersTable?.columns.some(
      (column) => column.name === 'is_deployed',
    );
    const hasUserDeployedIndex = userCharactersTable?.indices.some(
      (index) => index.name === 'IDX_user_characters_user_deployed',
    );

    if (hasDeployedTerritoryFk) {
      await queryRunner.query(
        `ALTER TABLE user_characters DROP FOREIGN KEY FK_user_characters_territory`,
      );
    }

    if (hasDeployedTerritoryIndex) {
      await queryRunner.query(
        `ALTER TABLE user_characters DROP INDEX IDX_user_characters_deployed_territory`,
      );
    }

    if (hasDeployedTerritoryColumn) {
      await queryRunner.query(
        `ALTER TABLE user_characters DROP COLUMN deployed_territory_id`,
      );
    }

    if (!hasIsDeployedColumn) {
      await queryRunner.query(
        `ALTER TABLE user_characters ADD COLUMN is_deployed TINYINT NOT NULL DEFAULT 0`,
      );
    }

    if (!hasUserDeployedIndex) {
      await queryRunner.query(
        `ALTER TABLE user_characters ADD INDEX IDX_user_characters_user_deployed (user_id, is_deployed)`,
      );
    }
  }
}
