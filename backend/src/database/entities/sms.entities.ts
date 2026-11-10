import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A phone number that opted in to SMS flood alerts. Personal data under the
 * Data Privacy Act (RA 10173): consent is recorded, numbers are masked on
 * officer screens, and opting out deactivates immediately.
 */
@Entity('sms_subscribers')
export class SmsSubscriber {
  /** E.164, e.g. +639171234567. */
  @PrimaryColumn({ type: 'text' })
  phone!: string;

  @Column({ type: 'text', default: 'fil' })
  locale!: 'en' | 'fil';

  @Column({ type: 'double precision', nullable: true })
  lat!: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng!: number | null;

  @Column({ type: 'text', nullable: true })
  barangay!: string | null;

  /** Receives alerts. Set after the code is confirmed (self sign-up) or by an officer. */
  @Column({ type: 'boolean', default: false })
  active!: boolean;

  /** 'app' = verified by one-time code; 'officer' = registered in person. */
  @Column({ type: 'text' })
  source!: 'app' | 'officer';

  @Column({ type: 'timestamptz', nullable: true })
  consentAt!: Date | null;

  /** Officer who registered this number in person (name), if any. */
  @Column({ type: 'text', nullable: true })
  addedBy!: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  // One-time code (hashed) for sign-up / opt-out confirmation.
  @Column({ type: 'text', nullable: true })
  otpHash!: string | null;

  @Column({ type: 'text', nullable: true })
  otpPurpose!: 'subscribe' | 'unsubscribe' | null;

  @Column({ type: 'timestamptz', nullable: true })
  otpExpiresAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  otpAttempts!: number;

  /** Codes sent in the current hour window (anti-abuse). */
  @Column({ type: 'int', default: 0 })
  otpSentInWindow!: number;

  @Column({ type: 'timestamptz', nullable: true })
  otpWindowStart!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

/** An officer-composed SMS broadcast (audit record). */
@Entity('sms_broadcasts')
export class SmsBroadcast {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'jsonb' })
  audience!:
    | { kind: 'all' }
    | {
        kind: 'near';
        nodeId: string;
        radiusM: number;
        includeUnlocated: boolean;
      };

  @Column({ type: 'text' })
  messageEn!: string;

  @Column({ type: 'text' })
  messageFil!: string;

  @Column({ type: 'int' })
  recipients!: number;

  /** Billed SMS parts across all recipients. */
  @Column({ type: 'int' })
  segments!: number;

  @Column({ type: 'int', default: 0 })
  failed!: number;

  @Column({ type: 'text' })
  createdBy!: string;

  @Column({ type: 'uuid' })
  createdByUserId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

/** Every SMS the system sent or tried to send (outbox + audit log). */
@Entity('sms_messages')
@Index(['createdAt'])
export class SmsMessage {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: string;

  @Column({ type: 'text' })
  kind!: 'auto' | 'broadcast' | 'otp';

  @Column({ type: 'text' })
  phone!: string;

  @Column({ type: 'text' })
  body!: string;

  /** simulated = console driver (development, nothing really sent). */
  @Column({ type: 'text' })
  status!: 'queued' | 'sent' | 'failed' | 'simulated';

  @Column({ type: 'text', nullable: true })
  providerId!: string | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'bigint', nullable: true })
  alertId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  broadcastId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
