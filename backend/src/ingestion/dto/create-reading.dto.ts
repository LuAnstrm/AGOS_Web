import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Channel } from '../../database/enums';

export class ImuDto {
  @IsNumber()
  @Min(0)
  @Max(90)
  tiltDeg!: number;

  @IsNumber()
  @Min(0)
  vibrationG!: number;
}

export class GpsDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class PowerDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  batteryPct!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  solarChargePct?: number;
}

/**
 * The one packet shape every source sends to POST /readings:
 * the simulator today, the LoRaWAN / 4G LTE / BLE Mesh gateway later.
 */
export class CreateReadingDto {
  @IsString()
  @IsNotEmpty()
  nodeId!: string;

  /** When the node took the measurement (ISO 8601). */
  @IsISO8601({ strict: true })
  timestamp!: string;

  /** Ultrasonic water depth in cm, unfiltered. */
  @IsNumber()
  @Min(0)
  @Max(1000)
  waterDepthCm!: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImuDto)
  imu?: ImuDto;

  /** Air temperature at the transducer (°C), used for speed-of-sound correction. */
  @IsOptional()
  @IsNumber()
  @Min(-20)
  @Max(70)
  temperatureC?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => GpsDto)
  gps?: GpsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PowerDto)
  power?: PowerDto;

  @IsEnum(Channel)
  channel!: Channel;
}
