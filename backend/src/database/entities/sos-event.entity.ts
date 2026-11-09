import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SosStatus } from '../../sos/sos-status';

/** Audit trail: one row per status change or note on an SOS request. */
@Entity('sos_events')
@Index(['sosId', 'createdAt'])
export class SosEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'uuid' })
  sosId!: string;

  @Column({ type: 'enum', enum: SosStatus })
  status!: SosStatus;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /** Display name of whoever made the change (null for system events). */
  @Column({ type: 'text', nullable: true })
  actor!: string | null;

  @Column({ type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
