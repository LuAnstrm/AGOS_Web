"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  API,
  getAlerts,
  getMe,
  getNodes,
  getCentres,
  getOpenSos,
  getSeries,
  isOpen,
  readingToPoint,
  SignedOutError,
  type Alert,
  type EvacCentre,
  type Officer,
  type SensorNode,
  type SeriesPoint,
  type SosRequest,
} from "@/lib/api";
import { BellRing, House, LifeBuoy, Radar, TriangleAlert } from "lucide-react";
import { tierRank } from "@/lib/tiers";
import { useLiveEvents } from "@/lib/useLiveEvents";
import { AlertFeed } from "./AlertFeed";
import { CentresPanel } from "./CentresPanel";
import { MapLegend } from "./MapLegend";
import { Panel } from "./Panel";
import { SituationStrip } from "./SituationStrip";
import { SmsDrawer } from "./SmsDrawer";
import { TopBar } from "./TopBar";
import { NodeList } from "./NodeList";
import { MlPanel } from "./MlPanel";
import { SosPanel } from "./SosPanel";
import { TrendChart } from "./TrendChart";

// Leaflet needs `window`, so the map renders on the client only.
const SensorMap = dynamic(() => import("./SensorMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-hover" />,
});

const SERIES_POINTS = 180; // 3 h at one uplink per minute
const MAX_ALERTS = 200;

const SOS_ORDER = { new: 0, acknowledged: 1, dispatched: 2, resolved: 3, cancelled: 4 } as const;

/** Triage order: untouched first, then oldest first within a status. */
const sortSos = (rs: SosRequest[]) =>
  [...rs].sort(
    (a, b) =>
      SOS_ORDER[a.status] - SOS_ORDER[b.status] ||
      Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );

/** Insert or replace by id; closed requests leave the open queue. */
const upsertSos = (rs: SosRequest[], r: SosRequest) =>
  sortSos([...rs.filter((x) => x.id !== r.id), ...(isOpen(r.status) ? [r] : [])]);

interface DashboardProps {
  officer: Officer;
  onSignOut: () => void;
  /** The backend no longer accepts our session (expired, or account removed). */
  onSessionExpired: () => void;
}

export function Dashboard({ officer, onSignOut, onSessionExpired }: DashboardProps) {
  const expiredRef = useRef(onSessionExpired);
  useEffect(() => {
    expiredRef.current = onSessionExpired;
  });
  const [nodes, setNodes] = useState<SensorNode[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [latest, setLatest] = useState<Record<string, SeriesPoint>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [series, setSeries] = useState<SeriesPoint[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [sos, setSos] = useState<SosRequest[]>([]);
  const [selectedSosId, setSelectedSosId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"sos" | "alerts" | "centres">("sos");
  const [centres, setCentres] = useState<EvacCentre[]>([]);
  const [selectedCentreId, setSelectedCentreId] = useState<string | null>(null);
  const [smsOpen, setSmsOpen] = useState(false);
  const [lastReadingAt, setLastReadingAt] = useState<number | null>(null);
  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  /** Full refresh — on first load and after every SSE (re)connect. */
  const refresh = useCallback(async () => {
    try {
      const [ns, as, ss, cs] = await Promise.all([getNodes(), getAlerts(MAX_ALERTS), getOpenSos(), getCentres()]);
      setCentres(cs);
      setNodes(ns);
      setAlerts(as);
      setSos(sortSos(ss));
      const lasts = await Promise.all(ns.map((n) => getSeries(n.id, 1).then((s) => [n.id, s[0]] as const)));
      setLatest(Object.fromEntries(lasts.filter(([, p]) => p)));
      const sel =
        selectedRef.current ??
        [...ns].sort((a, b) => tierRank(b.currentTier) - tierRank(a.currentTier))[0]?.id ??
        null;
      setSelectedId(sel);
      if (sel) setSeries(await getSeries(sel, SERIES_POINTS));
      setError(null);
    } catch (e) {
      if (e instanceof SignedOutError) expiredRef.current();
      else setError(`Can't reach the AGOS backend at ${API}.`);
    }
  }, []);

  const status = useLiveEvents({
    onConnect: () => void refresh(),
    onReading: (r) => {
      const p = readingToPoint(r);
      setLastReadingAt(Date.parse(r.receivedAt));
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
    onSos: ({ request }) => setSos((rs) => upsertSos(rs, request)),
    onCentre: (c) => setCentres((cs) => cs.map((x) => (x.id === c.id ? c : x))),
  });

  const select = useCallback(async (id: string) => {
    setSelectedId(id);
    selectedRef.current = id;
    setSeries([]);
    try {
      setSeries(await getSeries(id, SERIES_POINTS));
    } catch (e) {
      if (e instanceof SignedOutError) expiredRef.current();
      else setError(`Can't reach the AGOS backend at ${API}.`);
    }
  }, []);

  // EventSource can't report HTTP status. When the stream drops, ask the
  // backend whether the session is still valid, so an expired shift session
  // goes back to sign-in instead of "Reconnecting…" forever.
  useEffect(() => {
    if (status !== "reconnecting") return;
    let cancelled = false;
    getMe()
      .then((u) => {
        if (!cancelled && (!u || u.role !== "officer")) expiredRef.current();
      })
      .catch(() => undefined); // backend down: keep showing "Reconnecting…"
    return () => {
      cancelled = true;
    };
  }, [status]);

  const nodeById = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  const latestCm = useMemo(
    () => Object.fromEntries(Object.entries(latest).map(([k, p]) => [k, p.filteredCm ?? p.rawCm])),
    [latest],
  );
  const selected = selectedId ? nodeById[selectedId] : undefined;
  const newSos = sos.filter((r) => r.status === "new").length;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar officer={officer} status={status} onSignOut={onSignOut} onOpenSms={() => setSmsOpen(true)} />
      <SmsDrawer open={smsOpen} onClose={() => setSmsOpen(false)} nodes={nodes} />

      <main className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-4 p-4 lg:p-6">
        {(error || status === "reconnecting") && (
          <div role="alert" className="card flex items-start gap-3 border-l-4 px-4 py-3 text-sm" style={{ borderLeftColor: "var(--tier-warning)" }}>
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">Live feed interrupted.</span>{" "}
              {error ?? `Can't reach the AGOS backend at ${API}.`} Showing the last data received; it updates again as soon as
              the connection returns.
            </span>
          </div>
        )}

        <SituationStrip nodes={nodes} alerts={alerts} sos={sos} lastReadingAt={lastReadingAt} />

        <div className="grid flex-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_400px] lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Left: sensors */}
          <Panel
            icon={<Radar />}
            title="Sensors"
            meta={`${nodes.length} reporting`}
            className="order-2 lg:order-1 lg:max-h-[620px]"
            bodyClassName=""
          >
            <NodeList nodes={nodes} latestCm={latestCm} selectedId={selectedId} onSelect={select} />
          </Panel>

          {/* Centre: map */}
          <section
            className="card relative order-1 h-[460px] overflow-hidden lg:order-2 lg:h-[620px]"
            aria-label="Sensor map"
          >
            <SensorMap
              nodes={nodes}
              latestCm={latestCm}
              selectedId={selectedId}
              onSelect={select}
              sos={sos}
              selectedSosId={selectedSosId}
              onSelectSos={(id) => {
                setSelectedSosId(id);
                setRightTab("sos");
              }}
              centres={centres}
              selectedCentreId={selectedCentreId}
              onSelectCentre={(id) => {
                setSelectedCentreId(id);
                setRightTab("centres");
              }}
            />
            <MapLegend sosCount={sos.length} centreCount={centres.length} />
          </section>

          {/* Right: SOS, alerts, evacuation centres */}
          <section className="card order-3 flex min-h-[520px] flex-col overflow-hidden lg:col-span-2 xl:col-span-1 xl:h-[620px]">
            <div role="tablist" aria-label="Queues" className="flex border-b border-line">
              {(
                [
                  ["sos", "SOS", <LifeBuoy key="i" />, sos.length, newSos],
                  ["alerts", "Alerts", <BellRing key="i" />, alerts.length, 0],
                  ["centres", "Centres", <House key="i" />, centres.filter((c) => c.status === "open").length, 0],
                ] as const
              ).map(([id, label, icon, count, highlight]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={rightTab === id}
                  onClick={() => setRightTab(id)}
                  className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors [&>svg]:h-4 [&>svg]:w-4 ${
                    rightTab === id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {icon}
                  {label}
                  <span
                    className={`rounded-full px-1.5 py-px text-[11px] tabular ${
                      highlight ? "bg-ink text-page" : "bg-surface-2 text-ink-2"
                    }`}
                  >
                    {highlight ? `${highlight} new` : count}
                  </span>
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              {rightTab === "sos" ? (
                <SosPanel
                  requests={sos}
                  nodes={nodeById}
                  selectedSosId={selectedSosId}
                  onSelect={setSelectedSosId}
                  onUpdated={(r) => setSos((rs) => upsertSos(rs, r))}
                />
              ) : rightTab === "alerts" ? (
                <AlertFeed alerts={alerts} nodes={nodeById} selectedId={selectedId} onSelect={select} freshIds={freshIds} />
              ) : (
                <CentresPanel
                  centres={centres}
                  selectedId={selectedCentreId}
                  onSelect={setSelectedCentreId}
                  onUpdated={(c) => setCentres((cs) => cs.map((x) => (x.id === c.id ? c : x)))}
                />
              )}
            </div>
          </section>
        </div>

        {/* Selected sensor detail */}
        {selected ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <MlPanel node={selected} latest={latest[selected.id]} />
            <TrendChart points={series} />
          </div>
        ) : (
          <div className="card flex flex-col items-center gap-2 p-10 text-center">
            <Radar className="h-8 w-8 text-muted" aria-hidden />
            <p className="text-sm font-medium">{nodes.length ? "Select a sensor to see its detail" : "No sensors registered yet"}</p>
            <p className="text-xs text-muted">
              {nodes.length ? "Pick one on the map or in the list." : "Start the simulator or connect a gateway."}
            </p>
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 pb-2 pt-1 text-[11px] text-muted">
          <span>AGOS · BulSU ALAB COLLAB IoTLab · Malolos City CDRRMO pilot</span>
          <span>Data from simulated sensor nodes · Models: placeholder baselines</span>
        </footer>
      </main>
    </div>
  );
}
