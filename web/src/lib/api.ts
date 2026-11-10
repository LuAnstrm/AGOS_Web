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

/** The session is missing or expired; the UI should show sign-in. */
export class SignedOutError extends Error {
  constructor() {
    super("signed out");
  }
}

export interface Officer {
  id: string;
  email: string;
  displayName: string;
  role: "citizen" | "officer";
  locale: "en" | "fil";
}

/** Current session, or null when not signed in. */
export async function getMe(): Promise<Officer | null> {
  const res = await fetch(`${API}/auth/me`, { credentials: "include", cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`/auth/me → HTTP ${res.status}`);
  return (await res.json()) as Officer;
}

/** Signs in; the backend sets an HttpOnly session cookie. */
export async function signIn(email: string, password: string): Promise<Officer> {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json().catch(() => ({}))) as { user?: Officer; message?: string | string[] };
  if (!res.ok || !json.user) {
    const m = json.message;
    throw new Error(
      res.status === 401
        ? "Wrong email or password."
        : Array.isArray(m)
          ? m.join("; ")
          : (m ?? `Sign-in failed (HTTP ${res.status}).`),
    );
  }
  return json.user;
}

export async function signOut(): Promise<void> {
  await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(API + path, { cache: "no-store", credentials: "include" });
  if (res.status === 401) throw new SignedOutError();
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

// ---------------------------------------------------------------- SOS

export type SosStatus = "new" | "acknowledged" | "dispatched" | "resolved" | "cancelled";
export type SosNeed = "medical" | "elderly" | "children" | "pwd" | "pregnant" | "trapped";

export interface SosRequest {
  id: string;
  clientId: string;
  channel: "ble_mesh" | "app";
  relayNodeId: string | null;
  relayHops: number | null;
  reporterName: string | null;
  reporterPhone: string | null;
  lat: number;
  lng: number;
  peopleCount: number;
  needs: SosNeed[];
  message: string | null;
  status: SosStatus;
  assignedTeam: string | null;
  nearestNodeId: string | null;
  nearestNodeDistanceM: number | null;
  reportedAt: string | null;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt: string | null;
  dispatchedAt: string | null;
  closedAt: string | null;
  /** Nearest safe open evacuation centre (straight-line), for dispatch. */
  shelter?: {
    id: string;
    name: string;
    distanceM: number;
    compass: string;
    safety: "safe" | "caution" | "unsafe";
    placeholder: boolean;
  } | null;
}

export type CentreStatus = "open" | "full" | "closed";

export interface EvacCentre {
  id: string;
  name: string;
  barangay: string | null;
  lat: number;
  lng: number;
  kind: "school" | "court" | "hall" | "other";
  capacity: number | null;
  status: CentreStatus;
  placeholder: boolean;
  updatedAt: string;
}

export const getCentres = () => get<EvacCentre[]>("/evac/centers");

export async function updateCentre(id: string, status: CentreStatus): Promise<EvacCentre> {
  const res = await fetch(`${API}/evac/centers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (res.status === 401) throw new SignedOutError();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as EvacCentre;
}

export interface SosEventData {
  action: "created" | "updated";
  nodeId: string;
  request: SosRequest;
}

/** Mirrors backend/src/sos/sos-status.ts. */
export const SOS_NEXT: Record<SosStatus, readonly SosStatus[]> = {
  new: ["acknowledged", "cancelled"],
  acknowledged: ["dispatched", "resolved", "cancelled"],
  dispatched: ["resolved", "cancelled"],
  resolved: [],
  cancelled: [],
};

export const isOpen = (s: SosStatus) => s === "new" || s === "acknowledged" || s === "dispatched";

export const getOpenSos = () => get<SosRequest[]>("/sos?scope=open");

export async function updateSos(
  id: string,
  body: { status?: SosStatus; assignedTeam?: string; note?: string },
): Promise<SosRequest> {
  const res = await fetch(`${API}/sos/${id}`, {
    credentials: "include",
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new SignedOutError();
  const json = (await res.json()) as SosRequest & { message?: string | string[] };
  if (!res.ok) {
    const m = json.message;
    throw new Error(Array.isArray(m) ? m.join("; ") : (m ?? `HTTP ${res.status}`));
  }
  return json;
}
