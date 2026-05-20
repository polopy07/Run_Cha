import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedCharacters1746921700001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO characters (name, type, grade, base_attack, base_defense, base_speed, base_point_rate) VALUES
        ('약탈형1',    'territory', 'common',    8,  8,  12, 1.0),
        ('공격형1',    'attack',    'common',   12,  6,  14, 1.0),
        ('수비형1',    'defense',   'common',    6, 14,   8, 1.0),
        ('버프형1', 'buff',      'common',    8,  8,  16, 1.1),

        ('약탈형2',    'territory', 'rare',     14, 12,  16, 1.2),
        ('공격형2',    'attack',    'rare',     20, 10,  18, 1.1),
        ('수비형2',    'defense',   'rare',     10, 22,  12, 1.1),
        ('버프형2',  'buff',      'rare',     12, 12,  24, 1.3),

        ('약탈형3',    'territory', 'epic',     22, 20,  22, 1.5),
        ('공격형3',    'attack',    'epic',     34, 16,  24, 1.3),
        ('수비형3',      'defense',   'epic',     16, 38,  18, 1.3),
        ('버프형3',    'buff',      'epic',     20, 20,  36, 1.6),

        ('약탈형4',      'territory', 'legendary', 36, 34, 34, 2.0),
        ('공격형4',  'attack',    'legendary', 54, 28, 38, 1.8),
        ('수비형4',      'defense',   'legendary', 28, 60, 30, 1.8),
        ('버프형4',    'buff',      'legendary', 32, 32, 58, 2.2);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM characters`);
  }
}
