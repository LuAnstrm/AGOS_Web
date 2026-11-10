import { AlertTier, RiskClass } from '../database/enums';

/**
 * Messages pushed to clients. Same JSON on both transports:
 *   WebSocket /ws      → {"type": "...", "data": {...}} per frame
 *   SSE       /events  → `event: <type>` + `data: <json>`
 */

export interface ReadingEvent {
  type: 'reading';
  data: {
    nodeId: string;
    recordedAt: string;
    /** When the backend accepted the packet — clients can measure latency. */
    receivedAt: string;
    rawCm: number;
    filteredCm: number;
    rateCmPerMin: number | null;
    rejected: boolean;
    riskClass: RiskClass | null;
    confidence: number | null;
    forecast: { h1Cm: number; h6Cm: number; h24Cm: number } | null;
    modelVersion: string | null;
    tier: AlertTier;
  };
}

export interface AlertEvent {
  type: 'alert';
  data: {
    id: string;
    nodeId: string;
    tier: AlertTier;
    previousTier: AlertTier | null;
    messageEn: string;
    messageFil: string;
    createdAt: string;
    receivedAt: string;
    /** Clients should show a push notification (tier Watch or above). */
    notify: boolean;
  };
}

/**
 * SOS request created or changed. Contains personal data: officer channel
 * (SSE /events) only — the citizen WebSocket never forwards it.
 */
export interface SosRealtimeEvent {
  type: 'sos';
  data: {
    action: 'created' | 'updated';
    /** Nearest sensor node ('' if none), so ?nodes= filters still apply. */
    nodeId: string;
    request: Record<string, unknown> & { id: string; status: string };
  };
}

/** Evacuation centre opened / full / closed. Public safety information. */
export interface CentreEvent {
  type: 'centre';
  data: {
    nodeId: string;
    centre: Record<string, unknown> & { id: string; status: string };
  };
}

export type RealtimeEvent =
  ReadingEvent | AlertEvent | SosRealtimeEvent | CentreEvent;

/** Event types the citizen-facing WebSocket may carry. */
export const PUBLIC_EVENT_TYPES: ReadonlySet<RealtimeEvent['type']> = new Set([
  'reading',
  'alert',
  'centre',
]);

/** Parses "?nodes=A,B" into a filter set; empty/absent means all nodes. */
export function parseNodeFilter(
  raw: string | null | undefined,
): Set<string> | null {
  const ids = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length ? new Set(ids) : null;
}
