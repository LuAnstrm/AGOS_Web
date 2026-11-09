import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SosChannel } from '../database/entities';
import { SosNeed, SosStatus } from './sos-status';

/** Sent by the mobile app directly, or by the mesh gateway on its behalf. */
export class CreateSosDto {
  /** Generated once on the phone; makes re-delivery over the mesh idempotent. */
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  clientId!: string;

  @IsEnum(SosChannel)
  channel!: SosChannel;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  peopleCount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsEnum(SosNeed, { each: true })
  needs?: SosNeed[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reporterName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[+0-9 ()-]+$/)
  reporterPhone?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  reportedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  relayNodeId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(64)
  relayHops?: number;
}

/** Officer action from the dashboard. */
export class UpdateSosDto {
  @IsOptional()
  @IsEnum(SosStatus)
  status?: SosStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  assignedTeam?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
