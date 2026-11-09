import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Channel } from '../enums';
import { SensorNode } from './sensor-node.entity';

/**
 * Exactly what the node (or simulator) sent, before any filtering.
 * (node_id, recorded_at) is unique: the same reading arriving on a second
 * channel during failover is a duplicate and is dropped at ingestion.
 */
@Entity('readings_raw')
@Index(['nodeId', 'recordedAt'], { unique: true })
export class ReadingRaw {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'text' })
  nodeId!: string;

  @ManyToOne(() => SensorNode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'nodeId' })
  node?: SensorNode;

  /** Timestamp the node took the measurement. */
  @Column({ type: 'timestamptz' })
  recordedAt!: Date;

  /** Timestamp the backend accepted it (for latency measurement). */
  @CreateDateColumn({ type: 'timestamptz' })
  receivedAt!: Date;

  @Column({ type: 'double precision' })
  waterDepthCm!: number;

  @Column({ type: 'double precision', nullable: true })
  tiltDeg!: number | null;

  @Column({ type: 'double precision', nullable: true })
  vibrationG!: number | null;

  /** Air temperature at the ultrasonic transducer (°C). */
  @Column({ type: 'double precision', nullable: true })
  temperatureC!: number | null;

  @Column({ type: 'double precision', nullable: true })
  lat!: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng!: number | null;

  @Column({ type: 'double precision', nullable: true })
  batteryPct!: number | null;

  @Column({ type: 'double precision', nullable: true })
  solarChargePct!: number | null;

  @Column({ type: 'enum', enum: Channel })
  channel!: Channel;
}
