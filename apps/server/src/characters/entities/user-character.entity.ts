import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Character } from './character.entity';
import { Territory } from '../../territories/entities/territory.entity';

@Entity('user_characters')
export class UserCharacter {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column()
  character_id: number;

  @Column({ default: 1 })
  attack_lv: number;

  @Column({ default: 1 })
  defense_lv: number;

  @Column({ default: 1 })
  speed_lv: number;

  @Column({ default: 1 })
  point_lv: number;

  @Column({ type: 'int', nullable: true, default: null })
  deployed_territory_id: number | null;

  @ManyToOne(() => User, (user) => user.territories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Character, (character) => character.user_characters)
  @JoinColumn({ name: 'character_id' })
  character: Character;

  @ManyToOne(() => Territory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'deployed_territory_id' })
  deployed_territory: Territory | null;
}
