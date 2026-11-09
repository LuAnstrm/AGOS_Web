import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '../database/enums';
import { AccessRule, Principal } from './access';

export const ACCESS_KEY = 'agos:access';

/** Anyone, signed in or not. Public flood information. */
export const Public = () =>
  SetMetadata(ACCESS_KEY, { public: true } satisfies AccessRule);

/** Signed-in users with one of these roles. */
export const Roles = (...roles: UserRole[]) =>
  SetMetadata(ACCESS_KEY, { roles } satisfies AccessRule);

/** Gateways with the device key only (sensor ingestion). */
export const DeviceOnly = () =>
  SetMetadata(ACCESS_KEY, { device: true } satisfies AccessRule);

/** Gateways with the device key, or signed-in users with one of these roles. */
export const DeviceOr = (...roles: UserRole[]) =>
  SetMetadata(ACCESS_KEY, { device: true, roles } satisfies AccessRule);

export type RequestWithPrincipal = Request & { principal?: Principal };

/** The caller as resolved by AuthGuard. */
export const CurrentPrincipal = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Principal =>
    ctx.switchToHttp().getRequest<RequestWithPrincipal>().principal ?? {
      kind: 'anon',
    },
);
