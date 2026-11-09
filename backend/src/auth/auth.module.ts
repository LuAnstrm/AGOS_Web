import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AUTH_CONFIG, loadAuthConfig } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: loadAuthConfig(config).jwtSecret,
        signOptions: { algorithm: 'HS256', issuer: 'agos' },
        verifyOptions: { algorithms: ['HS256'], issuer: 'agos' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_CONFIG,
      inject: [ConfigService],
      useFactory: loadAuthConfig,
    },
    AuthService,
    // Every HTTP route goes through the guard; routes opt out with @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [AuthService, AUTH_CONFIG],
})
export class AuthModule {}
