import { Body, Controller, Delete, HttpCode, Post } from '@nestjs/common';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type { Principal } from '../auth/access';
import { CurrentPrincipal, Public } from '../auth/decorators';
import { EXPO_TOKEN } from './push-rules';
import { PushService } from './push.service';

class RegisterPushDto {
  @IsString()
  @Matches(EXPO_TOKEN, { message: 'token must be an Expo push token' })
  token!: string;

  @IsIn(['en', 'fil'])
  locale!: 'en' | 'fil';

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

class UnregisterPushDto {
  @IsString()
  @Matches(EXPO_TOKEN)
  token!: string;
}

/**
 * Push-token registration. Public: anyone may receive flood alerts, no
 * account needed. Only well-formed Expo tokens are accepted, so this can't
 * be used to make the server call arbitrary URLs.
 */
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Public()
  @Post('register')
  @HttpCode(204)
  async register(
    @Body() dto: RegisterPushDto,
    @CurrentPrincipal() who: Principal,
  ) {
    await this.push.register({
      ...dto,
      userId: who.kind === 'user' ? who.id : null,
    });
  }

  @Public()
  @Delete('register')
  @HttpCode(204)
  async unregister(@Body() dto: UnregisterPushDto) {
    await this.push.unregister(dto.token);
  }
}
