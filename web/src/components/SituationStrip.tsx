"use client";

import { Activity, BellRing, LifeBuoy, ShieldAlert, Timer } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Alert, SensorNode, SosRequest } from "@/lib/api";
import { TIER_LABEL, tierRank, tierVar, TIERS, type Tier } from "@/lib/tiers";

/**
 * The five things an officer needs first (top-left, largest): how bad is it,
 * how widespread, who is asking for help, how fast it's changing, and whether
 * the data is fresh. Everything else is detail below.
 */
export function SituationStrip({
  nodes,
  alerts,
  sos,
  lastReadingAt,
}: {
  nodes: SensorNode[];
  alerts: Alert[];
  sos: SosRequest[];
  lastReadingAt: number | null;
}) {
  const now = useNow(15_000);
  const worst: Tier = nodes.reduce<Tier>(
    (w, n) => (tierRank(n.currentTier) > tierRank(w) ? n.currentTier : w),
    "safe",
  );
  const atWatch = nodes.filter((n) => tierRank(n.currentTier) >= tierRank("watch")).length;
  const newSos = sos.filter((r) => r.status === "new").length;
  const people = sos.reduce((s, r) => s + r.peopleCount, 0);
  const lastHour = now == null ? 0 : alerts.filter((a) => now - Date.parse(a.createdAt) < 3600_000).length;
  const ageSec = now != null && lastReadingAt != null ? Math.max(0, Math.round((now - lastReadingAt) / 1000)) : null;
  const stale = ageSec != null && ageSec > 180;

  return (
    <section aria-label="Situation summary" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <Tile
        label="Highest tier"
        icon={<ShieldAlert />}
        accent={tierVar(worst)}
        value={
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: tierVar(worst) }} aria-hidden />
            {TIER_LABEL[worst].en}
          </span>
        }
        sub={<TierBar nodes={nodes} />}
      />
      <Tile
        label="Sensors at Watch or above"
        icon={<Activity />}
        value={
          <>
            {atWatch}
            <span className="ml-1 text-base font-medium text-muted">/ {nodes.length}</span>
          </>
        }
        sub={atWatch === 0 ? "All areas below Watch" : `${atWatch === nodes.length ? "Every" : `${atWatch} of`} ${nodes.length} sensors`}
      />
      <Tile
        label="Open SOS"
        icon={<LifeBuoy />}
        accent={newSos > 0 ? "var(--ink)" : undefined}
        value={
          <>
            {sos.length}
            {newSos > 0 && (
              <span className="ml-2 rounded-full bg-ink px-2 py-0.5 align-middle text-xs font-semibold text-page">
                {newSos} new
              </span>
            )}
          </>
        }
        sub={sos.length ? `${people} ${people === 1 ? "person" : "people"} waiting for help` : "No open requests"}
      />
      <Tile label="Alerts, last hour" icon={<BellRing />} value={lastHour} sub="Tier changes across all sensors" />
      <Tile
        label="Data freshness"
        icon={<Timer />}
        accent={stale ? "var(--tier-warning)" : undefined}
        value={ageSec == null ? "—" : ageSec < 60 ? `${ageSec}s` : `${Math.floor(ageSec / 60)}m ${ageSec % 60}s`}
        sub={stale ? "No readings for over 3 minutes — check gateways" : "Since the last sensor reading"}
      />
    </section>
  );
}

function Tile({
  label,
  icon,
  value,
  sub,
  accent,
}: {
  label: string;
  icon: ReactNode;
  value: ReactNode;
  sub: ReactNode;
  accent?: string;
}) {
  return (
    <div className="card relative overflow-hidden px-4 py-3">
      {accent && <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: accent }} />}
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-ink-2">{sub}</div>
    </div>
  );
}

/** Proportion of sensors in each tier, as a segmented bar with a text total. */
function TierBar({ nodes }: { nodes: SensorNode[] }) {
  if (!nodes.length) return <>No sensors</>;
  const counts = TIERS.map((t) => [t, nodes.filter((n) => n.currentTier === t).length] as const).filter(([, c]) => c);
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-1.5 flex-1 gap-[2px] overflow-hidden rounded-full" aria-hidden>
        {counts.map(([t, c]) => (
          <span key={t} style={{ flex: c, background: tierVar(t) }} />
        ))}
      </span>
      <span className="whitespace-nowrap">
        {counts.map(([t, c]) => `${c} ${TIER_LABEL[t].en}`).join(" · ")}
      </span>
    </span>
  );
}

function useNow(ms: number) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, ms);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [ms]);
  return now;
}
