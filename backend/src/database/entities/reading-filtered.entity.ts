import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReadingRaw } from './reading-raw.entity';

/** Output of the Extended Kalman Filter for one raw reading. */
@Entity('readings_filtered')
@Index(['nodeId', 'recordedAt'])
export class ReadingFiltered {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint', unique: true })
  rawId!: string;

  @OneToOne(() => ReadingRaw, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rawId' })
  raw?: ReadingRaw;

  @Column({ type: 'text' })
  nodeId!: string;

  @Column({ type: 'timestamptz' })
  recordedAt!: Date;

  @Column({ type: 'double precision' })
  waterDepthCm!: number;

  /** Estimated rate of change (cm/min) from the filter state. */
  @Column({ type: 'double precision', nullable: true })
  rateCmPerMin!: number | null;

  /** Posterior variance of the depth estimate. */
  @Column({ type: 'double precision', nullable: true })
  variance!: number | null;

  /** Full 2×2 state covariance [P00, P01, P10, P11]; lets the filter resume after a restart. */
  @Column({ type: 'double precision', array: true, nullable: true })
  covariance!: number[] | null;

  /** Raw reading was gated out as an outlier (debris/echo); value is the prediction. */
  @Column({ type: 'boolean', default: false })
  rejected!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
