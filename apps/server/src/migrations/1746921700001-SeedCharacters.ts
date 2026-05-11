import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedCharacters1746921700001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO characters (name, type, grade, base_attack, base_defense, base_speed, base_point_rate) VALUES
        ('방랑자',    'territory', 'common',    8,  8,  12, 1.0),
        ('정찰대',    'attack',    'common',   12,  6,  14, 1.0),
        ('수비대',    'defense',   'common',    6, 14,   8, 1.0),
        ('단거리주자', 'buff',      'common',    8,  8,  16, 1.1),

        ('탐험가',    'territory', 'rare',     14, 12,  16, 1.2),
        ('약탈자',    'attack',    'rare',     20, 10,  18, 1.1),
        ('파수꾼',    'defense',   'rare',     10, 22,  12, 1.1),
        ('마라토너',  'buff',      'rare',     12, 12,  24, 1.3),

        ('정복자',    'territory', 'epic',     22, 20,  22, 1.5),
        ('파괴자',    'attack',    'epic',     34, 16,  24, 1.3),
        ('요새',      'defense',   'epic',     16, 38,  18, 1.3),
        ('챔피언',    'buff',      'epic',     20, 20,  36, 1.6),

        ('군주',      'territory', 'legendary', 36, 34, 34, 2.0),
        ('전쟁군주',  'attack',    'legendary', 54, 28, 38, 1.8),
        ('철벽',      'defense',   'legendary', 28, 60, 30, 1.8),
        ('레전드',    'buff',      'legendary', 32, 32, 58, 2.2);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM gacha_log`);
    await queryRunner.query(`DELETE FROM user_characters`);
    await queryRunner.query(`DELETE FROM characters`);
  }
}
