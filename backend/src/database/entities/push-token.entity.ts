import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A phone that wants flood alerts while the app is closed. Registration
 * needs no account (flood alerts are public); the rough location lets
 * alerts go only to phones near the sensor.
 */
@Entity('push_tokens')
export class PushToken {
  /** Expo push token, e.g. "ExponentPushToken[xxxxxxxx]". */
  @PrimaryColumn({ type: 'text' })
  token!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'text', default: 'fil' })
  locale!: 'en' | 'fil';

  /** Last known position, rounded to ~100 m on the phone. */
  @Column({ type: 'double precision', nullable: true })
  lat!: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
