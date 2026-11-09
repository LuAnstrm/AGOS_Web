import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Ip,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Principal } from './access';
import { AUTH_CONFIG, type AuthConfig, SESSION_COOKIE } from './auth.config';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
import { CurrentPrincipal, Public } from './decorators';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  /** Citizen self-registration (mobile app). Officers are created by CLI. */
  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.registerCitizen(dto);
  }

  /**
   * Returns the token in the body (mobile: send as `Authorization: Bearer`)
   * and also sets an HttpOnly session cookie (web dashboard).
   */
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user, ttlSec } = await this.auth.login(
      dto.email,
      dto.password,
      ip,
    );
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.secureCookies,
      path: '/',
      maxAge: ttlSec * 1000,
    });
    return { accessToken: token, expiresIn: ttlSec, user };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  /** Any signed-in user. */
  @Get('me')
  me(@CurrentPrincipal() who: Principal) {
    // The guard guarantees a signed-in user here.
    return this.auth.me(who.kind === 'user' ? who.id : '');
  }
}
