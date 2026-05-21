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
      INNER JOIN (
        SELECT
          t2.id,
          AVG(jt.lat) AS avg_lat,
          AVG(jt.lng) AS avg_lng
        FROM territories t2
        CROSS JOIN JSON_TABLE(
          t2.coordinates,
          '$[*]' COLUMNS (
            lat DOUBLE PATH '$.lat',
            lng DOUBLE PATH '$.lng'
          )
        ) AS jt
        GROUP BY t2.id
      ) AS calc ON t.id = calc.id
      SET t.center_lat = calc.avg_lat,
          t.center_lng = calc.avg_lng;
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
