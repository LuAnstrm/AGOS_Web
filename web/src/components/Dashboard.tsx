"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  API,
  getAlerts,
  getNodes,
  getSeries,
  readingToPoint,
  type Alert,
  type SensorNode,
  type SeriesPoint,
} from "@/lib/api";
import { TIER_LABEL, TIERS, tierRank, tierVar } from "@/lib/tiers";
import { useLiveEvents } from "@/lib/useLiveEvents";
import { AlertFeed } from "./AlertFeed";
import { NodeList } from "./NodeList";
import { MlPanel } from "./MlPanel";
import { TrendChart } from "./TrendChart";

// Leaflet needs `window`, so the map renders on the client only.
const SensorMap = dynamic(() => import("./SensorMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-hover" />,
});

const SERIES_POINTS = 180; // 3 h at one uplink per minute
const MAX_ALERTS = 200;

export function Dashboard() {
  const [nodes, setNodes] = useState<SensorNode[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [latest, setLatest] = useState<Record<string, SeriesPoint>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  /** Full refresh — on first load and after every SSE (re)connect. */
  const refresh = useCallback(async () => {
    try {
      const [ns, as] = await Promise.all([getNodes(), getAlerts(MAX_ALERTS)]);
      setNodes(ns);
      setAlerts(as);
      const lasts = await Promise.all(ns.map((n) => getSeries(n.id, 1).then((s) => [n.id, s[0]] as const)));
      setLatest(Object.fromEntries(lasts.filter(([, p]) => p)));
      const sel =
        selectedRef.current ??
        [...ns].sort((a, b) => tierRank(b.currentTier) - tierRank(a.currentTier))[0]?.id ??
        null;
      setSelectedId(sel);
      if (sel) setSeries(await getSeries(sel, SERIES_POINTS));
      setError(null);
    } catch {
      setError(`Can't reach the AGOS backend at ${API}.`);
    }
  }, []);

  const status = useLiveEvents({
    onConnect: () => void refresh(),
    onReading: (r) => {
      const p = readingToPoint(r);
      setLatest((m) => ({ ...m, [r.nodeId]: p }));
      setNodes((ns) => {
        if (!ns.some((n) => n.id === r.nodeId)) {
          void refresh(); // a node we haven't seen — pick up its metadata
          return ns;
        }
        return ns.map((n) =>
          n.id === r.nodeId ? { ...n, currentTier: r.tier, lastSeenAt: r.recordedAt } : n,
        );
      });
      if (r.nodeId === selectedRef.current) {
        setSeries((s) =>
          s.length && s[s.length - 1].recordedAt >= p.recordedAt
            ? s
            : [...s, p].slice(-SERIES_POINTS),
        );
      }
    },
    onAlert: (a) => {
      setAlerts((as) => (as.some((x) => x.id === a.id) ? as : [a, ...as].slice(0, MAX_ALERTS)));
      setFreshIds((s) => new Set(s).add(a.id));
    },
  });

  const select = useCallback(async (id: string) => {
    setSelectedId(id);
    selectedRef.current = id;
    setSeries([]);
    try {
      setSeries(await getSeries(id, SERIES_POINTS));
    } catch {
      setError(`Can't reach the AGOS backend at ${API}.`);
    }
  }, []);

  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const latestCm = useMemo(
    () => Object.fromEntries(Object.entries(latest).map(([k, p]) => [k, p.filteredCm ?? p.rawCm])),
    [latest],
  );
  const counts = useMemo(() => {
    const c = Object.fromEntries(TIERS.map((t) => [t, 0])) as Record<(typeof TIERS)[number], number>;
    for (const n of nodes) c[n.currentTier]++;
    return c;
  }, [nodes]);
  const selected = selectedId ? nodeById[selectedId] : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <h1 className="text-lg font-semibold">AGOS flood monitoring</h1>
          <p className="text-xs text-muted">Malolos City pilot · DRRMO dashboard · simulation phase</p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Nodes per alert tier">
          {[...TIERS].reverse().map((t) => (
            <li key={t} className="flex items-center gap-1.5 text-sm">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: tierVar(t) }} />
              <span className="text-ink-2">{TIER_LABEL[t].en}</span>
              <span className="font-semibold">{counts[t]}</span>
            </li>
          ))}
        </ul>
        <LiveStatus status={status} />
      </header>

      {(error || status === "reconnecting") && (
        <div role="alert" className="rounded-md border border-line bg-surface px-4 py-3 text-sm">
          {error ?? `Can't reach the AGOS backend at ${API}.`} Start it with <code className="text-xs">npm run start:dev</code> in{" "}
          <code className="text-xs">backend/</code>.
        </div>
      )}

      <div className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="h-[380px] overflow-hidden rounded-lg border border-line bg-surface" aria-label="Sensor map">
            <SensorMap nodes={nodes} latestCm={latestCm} selectedId={selectedId} onSelect={select} />
          </section>
          <NodeList nodes={nodes} latestCm={latestCm} selectedId={selectedId} onSelect={select} />
          {selected ? (
            <>
              <MlPanel node={selected} latest={latest[selected.id]} />
              <TrendChart points={series} />
            </>
          ) : (
            <p className="rounded-lg border border-line bg-surface p-8 text-center text-sm text-muted">
              {nodes.length ? "Select a node on the map." : "No sensor nodes registered yet. Start the simulator."}
            </p>
          )}
        </div>
        <div className="flex min-h-[480px] flex-col lg:sticky lg:top-6 lg:h-[calc(100vh-7rem)]">
          <AlertFeed
            alerts={alerts}
            nodes={nodeById}
            selectedId={selectedId}
            onSelect={select}
            freshIds={freshIds}
          />
        </div>
      </div>
    </div>
  );
}

function LiveStatus({ status }: { status: string }) {
  const live = status === "live";
  return (
    <span className="ml-auto flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs">
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full ${live ? "animate-pulse" : ""}`}
        style={{ background: live ? "var(--tier-safe)" : "var(--muted)" }}
      />
      {live ? "Live" : status === "connecting" ? "Connecting…" : "Reconnecting…"}
    </span>
  );
}
