import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTerritoryCenter1747200000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE territories
        ADD COLUMN center_lat DOUBLE NULL,
        ADD COLUMN center_lng DOUBLE NULL;
    `);

    await queryRunner.query(`
      UPDATE territories t
        SET center_lat = (
              SELECT AVG(j.lat)
              FROM JSON_TABLE(t.coordinates, '$[*]' COLUMNS(lat DOUBLE PATH '$.lat')) AS j
            ),
            center_lng = (
              SELECT AVG(j.lng)
              FROM JSON_TABLE(t.coordinates, '$[*]' COLUMNS(lng DOUBLE PATH '$.lng')) AS j
            );
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
