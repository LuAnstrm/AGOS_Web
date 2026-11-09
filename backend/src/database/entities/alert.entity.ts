import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AlertTier } from '../enums';

/** A five-tier alert, written only when a node's tier changes. */
@Entity('alerts')
@Index(['nodeId', 'createdAt'])
export class Alert {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'text' })
  nodeId!: string;

  @Column({ type: 'enum', enum: AlertTier })
  tier!: AlertTier;

  @Column({ type: 'enum', enum: AlertTier, nullable: true })
  previousTier!: AlertTier | null;

  @Column({ type: 'bigint', nullable: true })
  filteredId!: string | null;

  @Column({ type: 'text' })
  messageEn!: string;

  @Column({ type: 'text' })
  messageFil!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
