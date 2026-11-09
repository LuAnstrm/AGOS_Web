import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { AlertTier, NodeSource } from '../enums';

@Entity('sensor_nodes')
export class SensorNode {
  /** Node ID as burned into firmware / used by the simulator, e.g. "MAL-LONGOS-01". */
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text', nullable: true })
  name!: string | null;

  @Column({ type: 'text', nullable: true })
  barangay!: string | null;

  @Column({ type: 'double precision', nullable: true })
  lat!: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng!: number | null;

  /** Sensor height above the channel bed (cm); needed to correct tilt and temperature. */
  @Column({ type: 'double precision', default: 400 })
  mountHeightCm!: number;

  /** Distinguishes simulated nodes on the dashboard map during this phase. */
  @Column({ type: 'enum', enum: NodeSource, default: NodeSource.SIMULATED })
  source!: NodeSource;

  @Column({ type: 'enum', enum: AlertTier, default: AlertTier.SAFE })
  currentTier!: AlertTier;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
