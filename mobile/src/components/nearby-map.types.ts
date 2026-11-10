import type { Tier } from "@/lib/tiers";

export interface MapSensor {
  id: string;
  name: string;
  lat: number;
  lng: number;
  tier: Tier;
  /** Tier word in the user's language, e.g. "Babala". */
  tierLabel: string;
  depthCm: number | null;
}

export interface MapCentre {
  id: string;
  name: string;
  lat: number;
  lng: number;
  open: boolean;
}

export interface NearbyMapProps {
  sensors: MapSensor[];
  centres: MapCentre[];
  me: { lat: number; lng: number } | null;
  colors: {
    tiers: Record<Tier, string>;
    brand: string;
    surface: string;
    ink: string;
    muted: string;
  };
  height?: number;
}

/** Bounding box around everything worth showing, padded a little. */
export function bounds(p: NearbyMapProps) {
  const pts = [
    ...p.sensors.map((s) => [s.lat, s.lng]),
    ...p.centres.map((c) => [c.lat, c.lng]),
    ...(p.me ? [[p.me.lat, p.me.lng]] : []),
  ] as [number, number][];
  if (!pts.length) return null;
  const lats = pts.map((x) => x[0]);
  const lngs = pts.map((x) => x[1]);
  const pad = 0.004;
  return {
    minLat: Math.min(...lats) - pad,
    maxLat: Math.max(...lats) + pad,
    minLng: Math.min(...lngs) - pad,
    maxLng: Math.max(...lngs) + pad,
  };
}
