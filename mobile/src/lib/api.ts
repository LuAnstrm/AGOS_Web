import { API_URL } from "./config";
import type { EvacCentre } from "./evac";
import type { RiskClass, Tier } from "./tiers";

export interface SensorNode {
  id: string;
  name: string | null;
  barangay: string | null;
  lat: number | null;
  lng: number | null;
  currentTier: Tier;
  lastSeenAt: string | null;
}

export interface SeriesPoint {
  recordedAt: string;
  rawCm: number;
  filteredCm: number | null;
  rateCmPerMin: number | null;
  riskClass: RiskClass | null;
  h1Cm: number | null;
  h6Cm: number | null;
  h24Cm: number | null;
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

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: "citizen" | "officer";
  locale: "en" | "fil";
}

export type SosNeed = "medical" | "elderly" | "children" | "pwd" | "pregnant" | "trapped";
export type SosStatus = "new" | "acknowledged" | "dispatched" | "resolved" | "cancelled";

export interface NewSos {
  clientId: string;
  channel: "app";
  lat: number;
  lng: number;
  peopleCount: number;
  needs: SosNeed[];
  message?: string;
  reporterPhone?: string;
  reportedAt: string;
}

/** What GET /sos/mine returns: status only, no personal data. */
export interface MySos {
  id: string;
  clientId: string;
  status: SosStatus;
  assignedTeam: string | null;
  peopleCount: number;
  createdAt: string;
  acknowledgedAt: string | null;
  dispatchedAt: string | null;
  closedAt: string | null;
}

/** HTTP error with the status code, so callers can tell 401 from offline. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Network unreachable / timed out (as opposed to a server answer). */
export class OfflineError extends Error {}

async function request<T>(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string | null; timeoutMs?: number } = {},
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      signal: ctrl.signal,
      headers: {
        ...(opts.body ? { "content-type": "application/json" } : {}),
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new OfflineError("no connection");
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  const json: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    const m = (json as { message?: string | string[] } | null)?.message;
    throw new ApiError(res.status, Array.isArray(m) ? m.join("; ") : (m ?? `HTTP ${res.status}`));
  }
  return json as T;
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export const api = {
  nodes: () => request<SensorNode[]>("GET", "/nodes"),
  alerts: (limit = 50) => request<Alert[]>("GET", `/alerts?limit=${limit}`),
  latest: (nodeId: string) =>
    request<SeriesPoint[]>("GET", `/nodes/${encodeURIComponent(nodeId)}/series?limit=1`).then(
      (r) => r[0] ?? null,
    ),
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: User }>("POST", "/auth/login", {
      body: { email, password },
    }),
  register: (b: { email: string; password: string; displayName: string; locale: "en" | "fil" }) =>
    request<User>("POST", "/auth/register", { body: b }),
  me: (token: string) => request<User>("GET", "/auth/me", { token }),
  sendSos: (token: string, sos: NewSos) =>
    request<{ id: string; status: SosStatus; duplicate: boolean }>("POST", "/sos", {
      token,
      body: sos,
      timeoutMs: 12000,
    }),
  mySos: (token: string) => request<MySos[]>("GET", "/sos/mine", { token }),
  centres: () => request<EvacCentre[]>("GET", "/evac/centers"),
};
