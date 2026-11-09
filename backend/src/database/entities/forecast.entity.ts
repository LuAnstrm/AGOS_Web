import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** LSTM water-level forecast for one filtered reading. */
@Entity('forecasts')
@Index(['nodeId', 'recordedAt'])
export class Forecast {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  filteredId!: string;

  @Column({ type: 'text' })
  nodeId!: string;

  @Column({ type: 'timestamptz' })
  recordedAt!: Date;

  @Column({ type: 'double precision' })
  h1Cm!: number;

  @Column({ type: 'double precision' })
  h6Cm!: number;

  @Column({ type: 'double precision' })
  h24Cm!: number;

  @Column({ type: 'text' })
  modelVersion!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
