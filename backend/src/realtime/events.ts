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

export type RealtimeEvent = ReadingEvent | AlertEvent;

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
