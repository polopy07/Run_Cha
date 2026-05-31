import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Territory } from '../../territories/entities/territory.entity';
import { UserCharacter } from '../../characters/entities/user-character.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 128 })
  firebase_uid: string;

  @Column({ length: 50 })
  nickname: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ default: 0 })
  points: number;

  @Column({ default: 0 })
  stat_points: number;

  @Column({ type: 'float', default: 0 })
  total_distance: number;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Territory, (territory) => territory.user)
  territories: Territory[];

  @OneToMany(() => UserCharacter, (uc) => uc.user)
  user_characters: UserCharacter[];
}
