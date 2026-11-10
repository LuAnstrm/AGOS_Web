import { AlertTier } from '../database/enums';
import { haversineM } from '../sos/sos-status';

/**
 * Evacuation-centre recommendation ("nearest safe centre first").
 *
 * No street routing: distance and direction are straight-line. Safety comes
 * from the sensor network:
 *   - a centre within CENTRE_HAZARD_M of a sensor at Watch or above is
 *     treated as unsafe and skipped (unless nothing else is open);
 *   - a straight-line path passing within PATH_HAZARD_M of such a sensor is
 *     returned with a caution, so the person knows to go around.
 * Walking time assumes streets add ~30% to the straight-line distance and a
 * pace of ~1.1 m/s (slower than normal: rain, children, belongings).
 */

export const CENTRE_HAZARD_M = 500;
export const PATH_HAZARD_M = 300;
const DETOUR = 1.3;
const WALK_M_PER_S = 1.1;

export type CentreStatus = 'open' | 'full' | 'closed';

export interface CentreIn {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: CentreStatus;
}

export interface HazardSensor {
  id: string;
  lat: number;
  lng: number;
  tier: AlertTier;
}

export interface Recommendation<C extends CentreIn = CentreIn> {
  centre: C;
  distanceM: number;
  bearingDeg: number;
  compass: string;
  walkMinutes: number;
  /** safe: no flooded sensor nearby; caution: path passes one; unsafe: centre itself is near one. */
  safety: 'safe' | 'caution' | 'unsafe';
  /** Sensors (ids) that caused a caution or unsafe rating. */
  near: string[];
}

const RANK: Record<AlertTier, number> = {
  [AlertTier.SAFE]: 0,
  [AlertTier.ADVISORY]: 1,
  [AlertTier.WATCH]: 2,
  [AlertTier.WARNING]: 3,
  [AlertTier.CRITICAL]: 4,
};
const flooded = (s: HazardSensor) => RANK[s.tier] >= RANK[AlertTier.WATCH];

export function bearingDeg(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(b.lng - a.lng)) * Math.cos(r(b.lat));
  const x =
    Math.cos(r(a.lat)) * Math.sin(r(b.lat)) -
    Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const compass = (deg: number) => COMPASS[Math.round(deg / 45) % 8];

/**
 * Shortest distance (m) from point p to the segment a→b, on a local flat
 * projection — accurate to well under a metre at city scale.
 */
export function distanceToSegmentM(
  p: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const k = Math.cos((a.lat * Math.PI) / 180);
  const toXY = (q: { lat: number; lng: number }) => ({
    x: (q.lng - a.lng) * 111_320 * k,
    y: (q.lat - a.lat) * 110_540,
  });
  const P = toXY(p);
  const B = toXY(b);
  const len2 = B.x * B.x + B.y * B.y;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, (P.x * B.x + P.y * B.y) / len2));
  return Math.hypot(P.x - t * B.x, P.y - t * B.y);
}

/**
 * Ranked recommendations from `from`: open centres only, safe before caution
 * before unsafe, then nearest first. Unsafe centres are kept at the end so
 * there is always an answer, clearly labelled.
 */
export function recommend<C extends CentreIn>(
  from: { lat: number; lng: number },
  centres: C[],
  sensors: HazardSensor[],
  limit = 3,
): Recommendation<C>[] {
  const hot = sensors.filter(flooded);
  const order = { safe: 0, caution: 1, unsafe: 2 } as const;
  return centres
    .filter((c) => c.status === 'open')
    .map((c): Recommendation<C> => {
      const atCentre = hot.filter((s) => haversineM(s, c) <= CENTRE_HAZARD_M);
      const onPath = hot.filter(
        (s) =>
          !atCentre.includes(s) &&
          distanceToSegmentM(s, from, c) <= PATH_HAZARD_M,
      );
      const distanceM = haversineM(from, c);
      const deg = bearingDeg(from, c);
      return {
        centre: c,
        distanceM: Math.round(distanceM),
        bearingDeg: Math.round(deg),
        compass: compass(deg),
        walkMinutes: Math.max(
          1,
          Math.round((distanceM * DETOUR) / WALK_M_PER_S / 60),
        ),
        safety: atCentre.length ? 'unsafe' : onPath.length ? 'caution' : 'safe',
        near: [...atCentre, ...onPath].map((s) => s.id),
      };
    })
    .sort(
      (a, b) => order[a.safety] - order[b.safety] || a.distanceM - b.distanceM,
    )
    .slice(0, limit);
}
