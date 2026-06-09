import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Index('IDX_territories_center', ['center_lat', 'center_lng'])
@Entity('territories')
export class Territory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  name: string | null;

  @Column({ type: 'json' })
  coordinates: { lat: number; lng: number }[];

  @Column({ type: 'float' })
  area_sqm: number;

  @Index('IDX_territories_occupation_rate')
  @Column({ default: 100 })
  occupation_rate: number;

  @Column({ type: 'double' })
  center_lat: number;

  @Column({ type: 'double' })
  center_lng: number;

  @Index('IDX_territories_last_active_at')
  @UpdateDateColumn()
  last_active_at: Date;

  @Index('IDX_territories_protected_until')
  @Column({ type: 'datetime', nullable: true, default: null })
  protected_until: Date | null;

  @ManyToOne(() => User, (user) => user.territories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
