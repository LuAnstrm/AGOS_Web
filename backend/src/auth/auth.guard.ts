import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { AccessRule, decideAccess, Principal } from './access';
import { AUTH_CONFIG, type AuthConfig, SESSION_COOKIE } from './auth.config';
import { AuthService } from './auth.service';
import { ACCESS_KEY, RequestWithPrincipal } from './decorators';

/**
 * Global guard. Resolves who is calling — device key, Bearer token (mobile),
 * or session cookie (web) — then applies the route's access rule. HTTP only;
 * the citizen WebSocket is public by design and carries no personal data.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const rule =
      this.reflector.getAllAndOverride<AccessRule>(ACCESS_KEY, [
        ctx.getHandler(),
        ctx.getClass(),
      ]) ?? {};
    const req = ctx.switchToHttp().getRequest<RequestWithPrincipal>();
    const who = await this.resolve(req);
    req.principal = who;

    switch (decideAccess(rule, who)) {
      case 'allow':
        return true;
      case 'unauthenticated':
        throw new UnauthorizedException('sign in required');
      case 'forbidden':
        throw new ForbiddenException('not allowed for this account');
    }
  }

  private async resolve(req: RequestWithPrincipal): Promise<Principal> {
    const key = req.header('x-device-key');
    if (key) {
      return this.matchesDeviceKey(key) ? { kind: 'device' } : { kind: 'anon' };
    }
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ')
      ? header.slice(7).trim()
      : readCookie(req.header('cookie'), SESSION_COOKIE);
    if (!token) return { kind: 'anon' };
    return (await this.auth.principalFromToken(token)) ?? { kind: 'anon' };
  }

  private matchesDeviceKey(given: string): boolean {
    const a = Buffer.from(given);
    const b = Buffer.from(this.config.deviceKey);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      return decodeURIComponent(part.slice(i + 1).trim());
    }
  }
  return null;
}
