import type { SensorNode } from "@/lib/api";
import { HIGH_FROM_CM, MODERATE_FROM_CM, tierRank, tierVar } from "@/lib/tiers";
import { TierBadge } from "./TierBadge";

const GAUGE_MAX_CM = 200;

interface Props {
  nodes: SensorNode[];
  latestCm: Record<string, number | undefined>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Every sensor, most severe first, with its depth on a small gauge marked at
 * the Moderate (45 cm) and High (90 cm) thresholds. Always readable (map
 * labels collide when sensors are close) and keyboard-selectable.
 */
export function NodeList({ nodes, latestCm, selectedId, onSelect }: Props) {
  const sorted = [...nodes].sort(
    (a, b) => tierRank(b.currentTier) - tierRank(a.currentTier) || a.id.localeCompare(b.id),
  );
  if (!sorted.length) {
    return <p className="px-4 py-10 text-center text-sm text-muted">No sensors registered yet.</p>;
  }

  return (
    <ul className="scroll-quiet space-y-1 overflow-y-auto p-2" aria-label="Sensors">
      {sorted.map((n) => {
        const depth = latestCm[n.id];
        const selected = n.id === selectedId;
        const pct = depth == null ? 0 : Math.min(100, (depth / GAUGE_MAX_CM) * 100);
        return (
          <li key={n.id}>
            <button
              onClick={() => onSelect(n.id)}
              aria-pressed={selected}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                selected ? "border-ink bg-hover" : "border-transparent hover:bg-hover"
              }`}
            >
              <span className="flex items-start gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{n.name ?? n.id}</span>
                  <span className="block truncate text-xs text-muted">
                    {n.barangay ?? n.id}
                    {n.source === "simulated" ? " · simulated" : ""}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-lg font-bold leading-6 tabular">
                    {depth == null ? "—" : Math.round(depth)}
                    {depth != null && <span className="ml-0.5 text-xs font-medium text-muted">cm</span>}
                  </span>
                </span>
              </span>
              <span className="mt-2 flex items-center gap-2">
                <TierBadge tier={n.currentTier} />
                <span
                  className="relative ml-auto h-1.5 w-28 overflow-hidden rounded-full bg-surface-2 ring-1 ring-line"
                  aria-hidden
                >
                  <span
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700"
                    style={{ width: `${pct}%`, background: tierVar(n.currentTier) }}
                  />
                  {[MODERATE_FROM_CM, HIGH_FROM_CM].map((t) => (
                    <span
                      key={t}
                      className="absolute inset-y-0 w-px bg-ink/40"
                      style={{ left: `${(t / GAUGE_MAX_CM) * 100}%` }}
                    />
                  ))}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
