import type { SensorNode } from "@/lib/api";
import { tierRank } from "@/lib/tiers";
import { TierBadge } from "./TierBadge";

interface Props {
  nodes: SensorNode[];
  latestCm: Record<string, number | undefined>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Every node with its tier and depth, most severe first. Always readable
 * (map labels collide when nodes are close) and keyboard-selectable.
 */
export function NodeList({ nodes, latestCm, selectedId, onSelect }: Props) {
  const sorted = [...nodes].sort(
    (a, b) => tierRank(b.currentTier) - tierRank(a.currentTier) || a.id.localeCompare(b.id),
  );
  if (!sorted.length) return null;

  return (
    <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Sensor nodes">
      {sorted.map((n) => {
        const depth = latestCm[n.id];
        const selected = n.id === selectedId;
        return (
          <li key={n.id}>
            <button
              onClick={() => onSelect(n.id)}
              aria-pressed={selected}
              className={`flex w-full items-center gap-3 rounded-lg border bg-surface px-3 py-2 text-left transition-colors hover:bg-hover ${
                selected ? "border-ink" : "border-line"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{n.name ?? n.id}</span>
                <TierBadge tier={n.currentTier} />
              </span>
              <span className="text-right">
                <span className="block text-lg font-semibold">
                  {depth == null ? "—" : Math.round(depth)}
                  {depth != null && <span className="ml-0.5 text-xs font-normal text-ink-2">cm</span>}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
