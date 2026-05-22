import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Territory } from '../../territories/entities/territory.entity';
import { UserCharacter } from '../../characters/entities/user-character.entity';
import { AttackResult } from '../enums/attack-result.enum';

@Check(`occupation_rate_before >= 0 AND occupation_rate_before <= 100`)
@Check(`occupation_rate_after >= 0 AND occupation_rate_after <= 100`)
@Index('IDX_attack_logs_attacker', ['attacker_id'])
@Index('IDX_attack_logs_defender', ['defender_id'])
@Index('IDX_attack_logs_territory', ['territory_id'])
@Index('IDX_attack_logs_created_at', ['created_at'])
@Entity('attack_logs')
export class AttackLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  attacker_id: number;

  @Column()
  defender_id: number;

  @Column()
  territory_id: number;

  @Column()
  attacker_character_id: number;

  @Column({ type: 'int', nullable: true, default: null })
  defender_character_id: number | null;

  @Column({ type: 'enum', enum: AttackResult })
  result: AttackResult;

  @Column()
  occupation_rate_before: number;

  @Column()
  occupation_rate_after: number;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attacker_id' })
  attacker: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'defender_id' })
  defender: User;

  @ManyToOne(() => Territory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'territory_id' })
  territory: Territory;

  @ManyToOne(() => UserCharacter, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'attacker_character_id' })
  attacker_character: UserCharacter;

  @ManyToOne(() => UserCharacter, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'defender_character_id' })
  defender_character: UserCharacter | null;
}
