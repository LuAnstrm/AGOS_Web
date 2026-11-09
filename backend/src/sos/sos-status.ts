/**
 * SOS request lifecycle.
 *
 *   new ──▶ acknowledged ──▶ dispatched ──▶ resolved
 *    │           │               │
 *    └───────────┴───────────────┴──▶ cancelled
 *
 * acknowledged → resolved is allowed (handled without sending a team, e.g.
 * the household reached safety on its own). resolved and cancelled are final.
 */
export enum SosStatus {
  NEW = 'new',
  ACKNOWLEDGED = 'acknowledged',
  DISPATCHED = 'dispatched',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled',
}

const NEXT: Record<SosStatus, readonly SosStatus[]> = {
  [SosStatus.NEW]: [SosStatus.ACKNOWLEDGED, SosStatus.CANCELLED],
  [SosStatus.ACKNOWLEDGED]: [
    SosStatus.DISPATCHED,
    SosStatus.RESOLVED,
    SosStatus.CANCELLED,
  ],
  [SosStatus.DISPATCHED]: [SosStatus.RESOLVED, SosStatus.CANCELLED],
  [SosStatus.RESOLVED]: [],
  [SosStatus.CANCELLED]: [],
};

export const OPEN_STATUSES: readonly SosStatus[] = [
  SosStatus.NEW,
  SosStatus.ACKNOWLEDGED,
  SosStatus.DISPATCHED,
];

export function canTransition(from: SosStatus, to: SosStatus): boolean {
  return NEXT[from].includes(to);
}

export function allowedNext(from: SosStatus): readonly SosStatus[] {
  return NEXT[from];
}

/** Needs a responder can triage on. Kept short: it is typed on a phone in a flood. */
export enum SosNeed {
  MEDICAL = 'medical',
  ELDERLY = 'elderly',
  CHILDREN = 'children',
  PWD = 'pwd',
  PREGNANT = 'pregnant',
  TRAPPED = 'trapped',
}

/** Great-circle distance in metres. */
export function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
