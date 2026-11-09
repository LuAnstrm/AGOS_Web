import { UserRole } from '../database/enums';

/**
 * Who is calling, as resolved by the auth guard from the request:
 *   user   — a signed-in citizen or officer (Bearer token or session cookie)
 *   device — a sensor gateway / mesh gateway / the simulator (X-Device-Key)
 *   anon   — nothing presented, or nothing valid
 */
export type Principal =
  | { kind: 'user'; id: string; role: UserRole; displayName: string }
  | { kind: 'device' }
  | { kind: 'anon' };

/**
 * Per-route access rule, set with the decorators in decorators.ts.
 *   public — anyone, including anonymous callers
 *   roles  — signed-in users with one of these roles
 *   device — also (or only, with no roles) gateways presenting the device key
 * A route with no rule requires any signed-in user.
 */
export interface AccessRule {
  public?: boolean;
  roles?: readonly UserRole[];
  device?: boolean;
}

export type AccessDecision = 'allow' | 'unauthenticated' | 'forbidden';

/** Pure decision used by the guard — unit-tested in access.spec.ts. */
export function decideAccess(rule: AccessRule, who: Principal): AccessDecision {
  if (rule.public) return 'allow';

  if (who.kind === 'device') {
    return rule.device ? 'allow' : 'forbidden';
  }
  if (who.kind === 'anon') return 'unauthenticated';

  // Signed-in user.
  if (rule.roles && rule.roles.length > 0) {
    return rule.roles.includes(who.role) ? 'allow' : 'forbidden';
  }
  // Device-only route (device: true, no roles): users are not allowed.
  if (rule.device) return 'forbidden';
  return 'allow';
}
