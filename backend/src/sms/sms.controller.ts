import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { Principal } from '../auth/access';
import { CurrentPrincipal, Public, Roles } from '../auth/decorators';
import { UserRole } from '../database/enums';
import { Audience, SmsService } from './sms.service';

class RequestCodeDto {
  @IsString()
  @MaxLength(20)
  phone!: string;

  @IsIn(['subscribe', 'unsubscribe'])
  purpose!: 'subscribe' | 'unsubscribe';

  @IsIn(['en', 'fil'])
  locale!: 'en' | 'fil';

  /** Required (true) to subscribe — Data Privacy Act consent. */
  @IsOptional()
  @IsBoolean()
  consent?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

class VerifyCodeDto {
  @IsString()
  @MaxLength(20)
  phone!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

class OfficerAddDto {
  @IsString()
  @MaxLength(20)
  phone!: string;

  @IsIn(['en', 'fil'])
  locale!: 'en' | 'fil';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  barangay?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  /** The officer confirms the person consented in writing / in person. */
  @Equals(true, { message: 'consent must be confirmed' })
  consentConfirmed!: true;
}

class AudienceDto {
  @IsIn(['all', 'near'])
  kind!: 'all' | 'near';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nodeId?: string;

  @IsOptional()
  @IsInt()
  @Min(500)
  @Max(20_000)
  radiusM?: number;

  @IsOptional()
  @IsBoolean()
  includeUnlocated?: boolean;
}

class BroadcastDto {
  @ValidateNested()
  @Type(() => AudienceDto)
  audience!: AudienceDto;

  /** Up to three SMS parts each, to keep costs predictable. */
  @IsString()
  @MinLength(1)
  @Length(1, 459)
  messageEn!: string;

  @IsString()
  @MinLength(1)
  @Length(1, 459)
  messageFil!: string;
}

class SendBroadcastDto extends BroadcastDto {
  /** Must equal the recipient count the officer saw in the preview. */
  @IsInt()
  @Min(1)
  confirmRecipients!: number;
}

const officerOf = (who: Principal) =>
  who.kind === 'user'
    ? { id: who.id, displayName: who.displayName }
    : { id: '', displayName: '' };

function toAudience(a: AudienceDto): Audience {
  if (a.kind === 'all') return { kind: 'all' };
  if (!a.nodeId) throw new Error('nodeId is required for a "near" audience');
  return {
    kind: 'near',
    nodeId: a.nodeId,
    radiusM: a.radiusM ?? 3000,
    includeUnlocated: a.includeUnlocated ?? false,
  };
}

/**
 * SMS alerts for people without the app (or without data).
 *   automatic  — Warning / Critical escalations, sent by the pipeline
 *   broadcast  — composed by an officer, previewed and confirmed
 * Sign-up is public but confirmed by a one-time code; officers can also
 * register people in person.
 */
@Controller('sms')
export class SmsController {
  constructor(private readonly sms: SmsService) {}

  @Public()
  @Post('code')
  @HttpCode(200)
  requestCode(@Body() dto: RequestCodeDto, @CurrentPrincipal() who: Principal) {
    return this.sms.requestCode({
      ...dto,
      userId: who.kind === 'user' ? who.id : null,
    });
  }

  @Public()
  @Post('verify')
  @HttpCode(200)
  verify(@Body() dto: VerifyCodeDto) {
    return this.sms.verifyCode(dto.phone, dto.code);
  }

  @Roles(UserRole.OFFICER)
  @Get('summary')
  summary() {
    return this.sms.summary();
  }

  @Roles(UserRole.OFFICER)
  @Post('subscribers')
  add(@Body() dto: OfficerAddDto, @CurrentPrincipal() who: Principal) {
    return this.sms.officerAdd(dto, officerOf(who));
  }

  @Roles(UserRole.OFFICER)
  @Delete('subscribers/:phone')
  @HttpCode(204)
  async remove(@Param('phone') phone: string) {
    await this.sms.officerRemove(phone);
  }

  @Roles(UserRole.OFFICER)
  @Post('broadcasts/preview')
  @HttpCode(200)
  preview(@Body() dto: BroadcastDto) {
    return this.sms.preview(
      toAudience(dto.audience),
      dto.messageEn,
      dto.messageFil,
    );
  }

  @Roles(UserRole.OFFICER)
  @Post('broadcasts')
  send(@Body() dto: SendBroadcastDto, @CurrentPrincipal() who: Principal) {
    return this.sms.broadcast(
      {
        audience: toAudience(dto.audience),
        messageEn: dto.messageEn,
        messageFil: dto.messageFil,
        confirmRecipients: dto.confirmRecipients,
      },
      officerOf(who),
    );
  }

  @Roles(UserRole.OFFICER)
  @Get('broadcasts')
  broadcasts() {
    return this.sms.broadcasts();
  }

  @Roles(UserRole.OFFICER)
  @Get('messages')
  messages() {
    return this.sms.messages();
  }
}
