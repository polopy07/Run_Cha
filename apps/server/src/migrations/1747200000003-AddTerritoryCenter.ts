import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTerritoryCenter1747200000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE territories
        ADD COLUMN center_lat DOUBLE NULL,
        ADD COLUMN center_lng DOUBLE NULL;
    `);

    await queryRunner.query(`
      UPDATE territories
        SET center_lat = JSON_UNQUOTE(JSON_EXTRACT(coordinates, '$[0].lat')),
            center_lng = JSON_UNQUOTE(JSON_EXTRACT(coordinates, '$[0].lng'));
    `);

    await queryRunner.query(`
      ALTER TABLE territories
        MODIFY COLUMN center_lat DOUBLE NOT NULL,
        MODIFY COLUMN center_lng DOUBLE NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE territories
        ADD INDEX IDX_territories_center (center_lat, center_lng);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE territories DROP INDEX IDX_territories_center`,
    );
    await queryRunner.query(`
      ALTER TABLE territories
        DROP COLUMN center_lat,
        DROP COLUMN center_lng;
    `);
  }
}
