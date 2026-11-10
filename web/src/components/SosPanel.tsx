"use client";

import { LifeBuoy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  SOS_NEXT,
  updateSos,
  type SensorNode,
  type SosNeed,
  type SosRequest,
  type SosStatus,
} from "@/lib/api";
import { TierBadge } from "./TierBadge";

const STATUS_LABEL: Record<SosStatus, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  dispatched: "Team dispatched",
  resolved: "Resolved",
  cancelled: "Cancelled",
};

const NEED_LABEL: Record<SosNeed, string> = {
  medical: "Medical",
  elderly: "Elderly",
  children: "Children",
  pwd: "PWD",
  pregnant: "Pregnant",
  trapped: "Trapped",
};

interface Props {
  requests: SosRequest[];
  nodes: Record<string, SensorNode>;
  selectedSosId: string | null;
  onSelect: (id: string) => void;
  /** Called with the server's copy after a successful update. */
  onUpdated: (r: SosRequest) => void;
}

/** Open SOS requests, untouched first then oldest first, with officer actions. */
export function SosPanel({ requests, nodes, selectedSosId, onSelect, onUpdated }: Props) {
  const now = useNow(30_000);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ol className="scroll-quiet min-h-0 flex-1 overflow-y-auto">
        {requests.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <LifeBuoy className="h-8 w-8 text-muted" aria-hidden />
            <span className="text-sm font-medium">No open SOS requests</span>
            <span className="max-w-[240px] text-xs text-muted">
              New requests from the mobile app and the mesh network appear here instantly.
            </span>
          </li>
        )}
        {requests.map((r) => (
          <SosCard
            key={r.id}
            r={r}
            node={r.nearestNodeId ? nodes[r.nearestNodeId] : undefined}
            now={now}
            selected={r.id === selectedSosId}
            onSelect={() => onSelect(r.id)}
            onUpdated={onUpdated}
          />
        ))}
      </ol>
    </div>
  );
}

function SosCard({
  r,
  node,
  now,
  selected,
  onSelect,
  onUpdated,
}: {
  r: SosRequest;
  node: SensorNode | undefined;
  now: number | null;
  selected: boolean;
  onSelect: () => void;
  onUpdated: (r: SosRequest) => void;
}) {
  const [team, setTeam] = useState(r.assignedTeam ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const next = SOS_NEXT[r.status];
  const act = async (status: SosStatus) => {
    setBusy(true);
    setError(null);
    try {
      onUpdated(
        await updateSos(r.id, {
          status,
          ...(status === "dispatched" ? { assignedTeam: team.trim() } : {}),
        }),
      );
      setConfirmCancel(false);
    } catch (e) {
      // e.g. 409 when another officer already moved this request on
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const btn =
    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50";
  const primary = `${btn} border-ink bg-ink text-page hover:opacity-90`;
  const secondary = `${btn} border-line text-ink-2 hover:bg-hover`;

  return (
    <li
      ref={ref}
      className={`mx-2 my-2 rounded-xl border px-4 py-3 transition-colors ${selected ? "border-ink bg-hover" : r.status === "new" ? "border-ink/30 bg-surface-2" : "border-line"}`}
      onClick={onSelect}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={`text-sm ${r.status === "new" ? "font-bold" : "font-semibold text-ink-2"}`}
        >
          {r.status === "new" && <span aria-hidden>● </span>}
          {STATUS_LABEL[r.status]}
          {r.status === "dispatched" && r.assignedTeam ? ` · ${r.assignedTeam}` : ""}
        </span>
        <span className="ml-auto text-xs text-muted" title={new Date(r.createdAt).toLocaleString()}>
          {ago(now, r.createdAt)}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
        <span className="font-semibold">
          {r.peopleCount} {r.peopleCount === 1 ? "person" : "people"}
        </span>
        {r.needs.map((n) => (
          <span key={n} className="rounded border border-line px-1.5 py-0.5 text-xs font-medium">
            {NEED_LABEL[n]}
          </span>
        ))}
      </div>

      {r.message && <p className="mt-1 text-sm leading-snug">“{r.message}”</p>}

      <div className="mt-1.5 space-y-0.5 text-xs text-ink-2">
        <div className="flex flex-wrap items-center gap-x-2">
          {node ? (
            <>
              <span>
                {r.nearestNodeDistanceM != null && `${r.nearestNodeDistanceM} m from `}
                {node.name ?? node.id}
              </span>
              <TierBadge tier={node.currentTier} />
            </>
          ) : (
            <span>
              {r.lat.toFixed(5)}, {r.lng.toFixed(5)}
            </span>
          )}
        </div>
        {r.shelter && (
          <div className="flex items-center gap-1.5">
            <span aria-hidden>⌂</span>
            <span>
              Nearest safe centre: <span className="font-medium text-ink">{r.shelter.name}</span> · {r.shelter.distanceM} m{" "}
              {r.shelter.compass}
              {r.shelter.safety !== "safe" && (
                <span className="font-semibold text-ink"> · {r.shelter.safety === "caution" ? "path near flooding" : "near flooding"}</span>
              )}
            </span>
          </div>
        )}
        <div>
          {r.reporterName ?? "Unnamed"}
          {r.reporterPhone && (
            <>
              {" · "}
              <a href={`tel:${r.reporterPhone.replace(/[^+0-9]/g, "")}`} className="underline">
                {r.reporterPhone}
              </a>
            </>
          )}
          {" · "}
          {r.channel === "ble_mesh"
            ? `Bluetooth Mesh${r.relayHops != null ? `, ${r.relayHops} hop${r.relayHops === 1 ? "" : "s"}` : ""}`
            : "App"}
        </div>
      </div>

      {next.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {next.includes("acknowledged") && (
            <button className={primary} disabled={busy} onClick={() => act("acknowledged")}>
              Acknowledge
            </button>
          )}
          {next.includes("dispatched") && (
            <>
              <input
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="Rescue team"
                aria-label="Rescue team to dispatch"
                maxLength={100}
                className="w-32 rounded-md border border-line bg-page px-2 py-1 text-xs"
              />
              <button
                className={primary}
                disabled={busy || !team.trim()}
                onClick={() => act("dispatched")}
              >
                Dispatch
              </button>
            </>
          )}
          {next.includes("resolved") && (
            <button
              className={r.status === "dispatched" ? primary : secondary}
              disabled={busy}
              onClick={() => act("resolved")}
            >
              Resolve
            </button>
          )}
          {next.includes("cancelled") &&
            (confirmCancel ? (
              <span className="flex items-center gap-1.5 text-xs">
                Cancel this request?
                <button className={secondary} disabled={busy} onClick={() => act("cancelled")}>
                  Yes, cancel
                </button>
                <button className={secondary} onClick={() => setConfirmCancel(false)}>
                  No
                </button>
              </span>
            ) : (
              <button className={secondary} disabled={busy} onClick={() => setConfirmCancel(true)}>
                Cancel
              </button>
            ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-ink">
          Couldn’t update: {error}
        </p>
      )}
    </li>
  );
}

function ago(now: number | null, iso: string) {
  if (now == null) return "";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min ago`;
}

/**
 * Current time, refreshed every `ms` so relative times stay current. Starts
 * as null and is read only in the browser: a clock in initial state would be
 * frozen into the prerendered page.
 */
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
