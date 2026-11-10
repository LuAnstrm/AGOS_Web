import { TIER_LABEL, TIERS, tierVar } from "@/lib/tiers";

/** Floating legend over the map: tiers, the SOS marker, and what pulsing means. */
export function MapLegend({ sosCount }: { sosCount: number }) {
  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-[500] rounded-xl border border-line bg-surface/90 px-3 py-2.5 text-xs shadow-pop backdrop-blur">
      <div className="mb-1.5 font-semibold">Legend</div>
      <ul className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1">
        {[...TIERS].reverse().map((t) => (
          <li key={t} className="flex items-center gap-1.5 text-ink-2">
            <span className="h-2.5 w-2.5 rounded-full ring-2 ring-surface" style={{ background: tierVar(t) }} />
            {TIER_LABEL[t].en}
          </li>
        ))}
        <li className="flex items-center gap-1.5 text-ink-2">
          <span className="rounded-[3px] bg-ink px-1 text-[9px] font-bold leading-[14px] text-page">SOS</span>
          {sosCount ? `${sosCount} open` : "Request"}
        </li>
      </ul>
      <div className="mt-1.5 text-[11px] text-muted">Pulsing = Critical or new SOS</div>
    </div>
  );
}
