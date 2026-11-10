import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export enum EvacKind {
  SCHOOL = 'school',
  COURT = 'court',
  HALL = 'hall',
  OTHER = 'other',
}

export enum EvacStatus {
  OPEN = 'open',
  FULL = 'full',
  CLOSED = 'closed',
}

/** An evacuation centre. Status is set by DRRMO officers during an event. */
@Entity('evac_centers')
export class EvacCenter {
  /** Stable slug, e.g. "placeholder-longos-school". */
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  barangay!: string | null;

  @Column({ type: 'double precision' })
  lat!: number;

  @Column({ type: 'double precision' })
  lng!: number;

  @Column({ type: 'enum', enum: EvacKind, default: EvacKind.OTHER })
  kind!: EvacKind;

  /** People it can shelter, if known. */
  @Column({ type: 'int', nullable: true })
  capacity!: number | null;

  @Column({ type: 'enum', enum: EvacStatus, default: EvacStatus.OPEN })
  status!: EvacStatus;

  /** True for made-up demo locations — replace with the CDRRMO's real list. */
  @Column({ type: 'boolean', default: false })
  placeholder!: boolean;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
