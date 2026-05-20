import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('running_log')
export class RunningLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column({ type: 'json' })
  path: { lat: number; lng: number }[];

  @Column({ type: 'float' })
  distance_km: number;

  @Column({ default: 0 })
  earned_points: number;

  @Column({ type: 'float', default: 0 })
  area_sqm: number;

  @Column({ type: 'float' })
  avg_pace: number;

  @Column({ type: 'datetime' })
  started_at: Date;

  @Column({ type: 'datetime', nullable: true })
  ended_at: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
