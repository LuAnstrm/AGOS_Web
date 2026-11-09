import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEV_JWT_SECRET = 'agos-dev-jwt-secret-change-me';
const DEV_DEVICE_KEY = 'agos-dev-device-key';

export interface AuthConfig {
  jwtSecret: string;
  deviceKey: string;
  /** Session length for officers (one shift) and citizens (mobile). */
  officerTtlSec: number;
  citizenTtlSec: number;
  secureCookies: boolean;
  webOrigins: string[];
}

/**
 * Reads auth settings. In production, missing secrets stop the server from
 * starting; in development, well-known dev values are used with a warning.
 */
export function loadAuthConfig(config: ConfigService): AuthConfig {
  const prod = config.get<string>('NODE_ENV') === 'production';
  const log = new Logger('AuthConfig');

  const jwtSecret = config.get<string>('JWT_SECRET');
  const deviceKey = config.get<string>('DEVICE_API_KEY');
  if (prod && (!jwtSecret || jwtSecret.length < 32)) {
    throw new Error('JWT_SECRET (32+ chars) is required in production');
  }
  if (prod && (!deviceKey || deviceKey.length < 24)) {
    throw new Error('DEVICE_API_KEY (24+ chars) is required in production');
  }
  if (!jwtSecret) log.warn('JWT_SECRET not set — using the development secret');
  if (!deviceKey)
    log.warn(
      `DEVICE_API_KEY not set — using the development key "${DEV_DEVICE_KEY}"`,
    );

  return {
    jwtSecret: jwtSecret ?? DEV_JWT_SECRET,
    deviceKey: deviceKey ?? DEV_DEVICE_KEY,
    officerTtlSec: 8 * 3600,
    citizenTtlSec: 30 * 24 * 3600,
    secureCookies: prod,
    webOrigins: (config.get<string>('WEB_ORIGINS') ?? 'http://localhost:3001')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
export const SESSION_COOKIE = 'agos_session';
