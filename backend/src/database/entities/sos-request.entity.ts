import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SosNeed, SosStatus } from '../../sos/sos-status';

export enum SosChannel {
  /** Relayed peer-to-peer over the Bluetooth Mesh (simulated in this phase). */
  BLE_MESH = 'ble_mesh',
  /** Sent directly by the app over the internet. */
  APP = 'app',
}

/**
 * A citizen distress request. Holds personal data (name, phone, location):
 * only officer-facing endpoints may expose it.
 */
@Entity('sos_requests')
@Index(['status', 'createdAt'])
export class SosRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Generated on the phone; the same request relayed twice is one request. */
  @Column({ type: 'text', unique: true })
  clientId!: string;

  @Column({ type: 'enum', enum: SosChannel })
  channel!: SosChannel;

  /** Mesh node that delivered it to the gateway, if relayed. */
  @Column({ type: 'text', nullable: true })
  relayNodeId!: string | null;

  @Column({ type: 'int', nullable: true })
  relayHops!: number | null;

  /** Signed-in citizen who sent it (null when relayed by the mesh gateway). */
  @Column({ type: 'uuid', nullable: true })
  reporterUserId!: string | null;

  @Column({ type: 'text', nullable: true })
  reporterName!: string | null;

  @Column({ type: 'text', nullable: true })
  reporterPhone!: string | null;

  @Column({ type: 'double precision' })
  lat!: number;

  @Column({ type: 'double precision' })
  lng!: number;

  @Column({ type: 'int', default: 1 })
  peopleCount!: number;

  @Column({ type: 'enum', enum: SosNeed, array: true, default: [] })
  needs!: SosNeed[];

  @Column({ type: 'text', nullable: true })
  message!: string | null;

  @Column({ type: 'enum', enum: SosStatus, default: SosStatus.NEW })
  status!: SosStatus;

  @Column({ type: 'text', nullable: true })
  assignedTeam!: string | null;

  /** Closest sensor node at the time of the request, for flood context. */
  @Column({ type: 'text', nullable: true })
  nearestNodeId!: string | null;

  @Column({ type: 'double precision', nullable: true })
  nearestNodeDistanceM!: number | null;

  /** When the phone says it sent the request (may predate receipt via mesh). */
  @Column({ type: 'timestamptz', nullable: true })
  reportedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  acknowledgedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  dispatchedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt!: Date | null;
}
