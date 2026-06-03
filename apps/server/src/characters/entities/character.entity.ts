import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserCharacter } from './user-character.entity';

export enum CharacterType {
  ATTACK = 'attack',
  DEFENSE = 'defense',
  BUFF = 'buff',
}

export enum CharacterGrade {
  COMMON = 'common',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

@Entity('characters')
export class Character {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50 })
  name: string;

  @Column({ type: 'enum', enum: CharacterType })
  type: CharacterType;

  @Column({ type: 'enum', enum: CharacterGrade })
  grade: CharacterGrade;

  @Column({ type: 'float', default: 10 })
  base_attack: number;

  @Column({ type: 'float', default: 10 })
  base_defense: number;

  @Column({ type: 'float', default: 1 })
  base_point_rate: number;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  image_url: string | null;

  @OneToMany(() => UserCharacter, (uc) => uc.character)
  user_characters: UserCharacter[];
}
