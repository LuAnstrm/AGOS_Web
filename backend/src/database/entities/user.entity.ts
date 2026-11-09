import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRole } from '../enums';

/** Citizens (mobile) and DRRMO officers (web) share one table, split by role. */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  email!: string;

  @Column({ type: 'text' })
  passwordHash!: string;

  @Column({ type: 'text' })
  displayName!: string;

  @Column({ type: 'enum', enum: UserRole })
  role!: UserRole;

  /** Preferred alert language. */
  @Column({ type: 'text', default: 'fil' })
  locale!: 'en' | 'fil';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
