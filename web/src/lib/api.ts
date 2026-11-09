import type { RiskClass, Tier } from "./tiers";

/** Backend base URL. Inlined at build time. */
export const API = (process.env.NEXT_PUBLIC_AGOS_API ?? "http://localhost:3000").replace(/\/$/, "");

export interface SensorNode {
  id: string;
  name: string | null;
  barangay: string | null;
  lat: number | null;
  lng: number | null;
  mountHeightCm: number;
  source: "simulated" | "hardware";
  currentTier: Tier;
  lastSeenAt: string | null;
}

/** One row of GET /nodes/:id/series (and the shape live readings are merged into). */
export interface SeriesPoint {
  recordedAt: string;
  rawCm: number;
  filteredCm: number | null;
  rateCmPerMin: number | null;
  rejected: boolean | null;
  riskClass: RiskClass | null;
  confidence: number | null;
  h1Cm: number | null;
  h6Cm: number | null;
  h24Cm: number | null;
  modelVersion: string | null;
}

export interface Alert {
  id: string;
  nodeId: string;
  tier: Tier;
  previousTier: Tier | null;
  messageEn: string;
  messageFil: string;
  createdAt: string;
}

/** Realtime payloads — mirror backend/src/realtime/events.ts. */
export interface ReadingEventData {
  nodeId: string;
  recordedAt: string;
  receivedAt: string;
  rawCm: number;
  filteredCm: number;
  rateCmPerMin: number | null;
  rejected: boolean;
  riskClass: RiskClass | null;
  confidence: number | null;
  forecast: { h1Cm: number; h6Cm: number; h24Cm: number } | null;
  modelVersion: string | null;
  tier: Tier;
}

export interface AlertEventData extends Alert {
  receivedAt: string;
  notify: boolean;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(API + path, { cache: "no-store" });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const getNodes = () => get<SensorNode[]>("/nodes");
export const getAlerts = (limit = 100) => get<Alert[]>(`/alerts?limit=${limit}`);
export const getSeries = (nodeId: string, limit = 180) =>
  get<SeriesPoint[]>(`/nodes/${encodeURIComponent(nodeId)}/series?limit=${limit}`);

export function readingToPoint(r: ReadingEventData): SeriesPoint {
  return {
    recordedAt: r.recordedAt,
    rawCm: r.rawCm,
    filteredCm: r.filteredCm,
    rateCmPerMin: r.rateCmPerMin,
    rejected: r.rejected,
    riskClass: r.riskClass,
    confidence: r.confidence,
    h1Cm: r.forecast?.h1Cm ?? null,
    h6Cm: r.forecast?.h6Cm ?? null,
    h24Cm: r.forecast?.h24Cm ?? null,
    modelVersion: r.modelVersion,
  };
}

export const placeName = (n: Pick<SensorNode, "id" | "name" | "barangay">) =>
  n.name ?? n.id;
