import * as Location from "expo-location";
import type { SensorNode } from "./api";

export interface Position {
  lat: number;
  lng: number;
}

export type LocationState =
  | { kind: "unknown" }
  | { kind: "denied" }
  | { kind: "ok"; position: Position; at: number };

/** Great-circle distance in metres. */
export function distanceM(a: Position, b: Position): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

/** Nodes with coordinates, nearest first (with distance), or as-is without a position. */
export function byDistance(nodes: SensorNode[], pos: Position | null) {
  const placed = nodes.filter((n) => n.lat != null && n.lng != null);
  if (!pos) return placed.map((n) => ({ node: n, distanceM: null as number | null }));
  return placed
    .map((n) => ({ node: n, distanceM: distanceM(pos, { lat: n.lat!, lng: n.lng! }) as number | null }))
    .sort((a, b) => a.distanceM! - b.distanceM!);
}

export async function locate(ask: boolean): Promise<LocationState> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && ask && perm.canAskAgain) {
      perm = await Location.requestForegroundPermissionsAsync();
    }
    if (!perm.granted) return { kind: "denied" };
    // A fix can take long (or never come) indoors; don't leave the app waiting.
    const p = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("location timeout")), 10_000)),
    ]);
    return {
      kind: "ok",
      position: { lat: p.coords.latitude, lng: p.coords.longitude },
      at: Date.now(),
    };
  } catch {
    return { kind: "denied" };
  }
}
