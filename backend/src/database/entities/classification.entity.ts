import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RiskClass } from '../enums';

/** Random Forest flood-risk class for one filtered reading. */
@Entity('classifications')
@Index(['nodeId', 'recordedAt'])
export class Classification {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  filteredId!: string;

  @Column({ type: 'text' })
  nodeId!: string;

  @Column({ type: 'timestamptz' })
  recordedAt!: Date;

  @Column({ type: 'enum', enum: RiskClass })
  riskClass!: RiskClass;

  @Column({ type: 'double precision', nullable: true })
  confidence!: number | null;

  @Column({ type: 'text' })
  modelVersion!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
