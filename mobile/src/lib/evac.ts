import { distanceM, type Position } from "./geo";
import { tierRank, type Tier } from "./tiers";

/**
 * Nearest safe evacuation centre, computed ON THE PHONE from cached data so it
 * still works with no signal.
 *
 * KEEP IN SYNC with backend/src/evac/evac-rules.ts (same thresholds and
 * ordering; the backend version is the unit-tested reference).
 */
const CENTRE_HAZARD_M = 500;
const PATH_HAZARD_M = 300;
const DETOUR = 1.3;
const WALK_M_PER_S = 1.1;

export interface EvacCentre {
  id: string;
  name: string;
  barangay: string | null;
  lat: number;
  lng: number;
  kind: "school" | "court" | "hall" | "other";
  capacity: number | null;
  status: "open" | "full" | "closed";
  placeholder: boolean;
}

export interface Sensor {
  id: string;
  lat: number;
  lng: number;
  tier: Tier;
}

export interface Recommendation {
  centre: EvacCentre;
  distanceM: number;
  bearingDeg: number;
  compass: string;
  walkMinutes: number;
  safety: "safe" | "caution" | "unsafe";
}

function bearingDeg(a: Position, b: Position): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(b.lng - a.lng)) * Math.cos(r(b.lat));
  const x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) - Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS_EN = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function distanceToSegmentM(p: Position, a: Position, b: Position): number {
  const k = Math.cos((a.lat * Math.PI) / 180);
  const P = { x: (p.lng - a.lng) * 111_320 * k, y: (p.lat - a.lat) * 110_540 };
  const B = { x: (b.lng - a.lng) * 111_320 * k, y: (b.lat - a.lat) * 110_540 };
  const len2 = B.x * B.x + B.y * B.y;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (P.x * B.x + P.y * B.y) / len2));
  return Math.hypot(P.x - t * B.x, P.y - t * B.y);
}

export function recommend(from: Position, centres: EvacCentre[], sensors: Sensor[], limit = 3): Recommendation[] {
  const hot = sensors.filter((s) => tierRank(s.tier) >= tierRank("watch"));
  const order = { safe: 0, caution: 1, unsafe: 2 } as const;
  return centres
    .filter((c) => c.status === "open")
    .map((c): Recommendation => {
      const atCentre = hot.some((s) => distanceM(s, c) <= CENTRE_HAZARD_M);
      const onPath = !atCentre && hot.some((s) => distanceToSegmentM(s, from, c) <= PATH_HAZARD_M);
      const d = distanceM(from, c);
      const deg = bearingDeg(from, c);
      return {
        centre: c,
        distanceM: Math.round(d),
        bearingDeg: Math.round(deg),
        compass: COMPASS_EN[Math.round(deg / 45) % 8],
        walkMinutes: Math.max(1, Math.round((d * DETOUR) / WALK_M_PER_S / 60)),
        safety: atCentre ? "unsafe" : onPath ? "caution" : "safe",
      };
    })
    .sort((a, b) => order[a.safety] - order[b.safety] || a.distanceM - b.distanceM)
    .slice(0, limit);
}

/** Walking directions in the phone's own maps app (real streets). */
export function directionsUrl(c: { lat: number; lng: number }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=walking`;
}
