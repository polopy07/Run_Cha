import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('territories')
export class Territory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column({ type: 'json' })
  coordinates: { lat: number; lng: number }[];

  @Column({ type: 'float' })
  area_sqm: number;

  @Column({ default: 100 })
  occupation_rate: number;

  @UpdateDateColumn()
  last_active_at: Date;

  @ManyToOne(() => User, (user) => user.territories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
