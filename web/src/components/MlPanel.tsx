import type { SensorNode, SeriesPoint } from "@/lib/api";
import { RISK_LABEL } from "@/lib/tiers";
import { TierBadge } from "./TierBadge";

/** Current classification and the 1h / 6h / 24h forecast for one node. */
export function MlPanel({ node, latest }: { node: SensorNode; latest: SeriesPoint | undefined }) {
  const baseline = latest?.modelVersion?.startsWith("baseline");
  const rate = latest?.rateCmPerMin;

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">{node.name ?? node.id}</h2>
        <span className="text-xs text-muted">
          {node.barangay ?? ""} · {node.id}
          {node.source === "simulated" ? " · simulated" : ""}
        </span>
        <span className="ml-auto">
          <TierBadge tier={node.currentTier} />
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Depth now" value={fmt(latest?.filteredCm)} unit="cm" />
        <Stat
          label="Trend"
          value={rate == null ? "—" : `${rate > 0 ? "+" : ""}${rate.toFixed(1)}`}
          unit="cm/min"
        />
        <Stat
          label="Risk class"
          value={latest?.riskClass ? RISK_LABEL[latest.riskClass] : "—"}
          sub={latest?.confidence != null ? `${Math.round(latest.confidence * 100)}% conf.` : undefined}
        />
        <Stat label="In 1 h" value={fmt(latest?.h1Cm)} unit="cm" />
        <Stat label="In 6 h" value={fmt(latest?.h6Cm)} unit="cm" />
        <Stat label="In 24 h" value={fmt(latest?.h24Cm)} unit="cm" />
      </div>

      {latest?.modelVersion && (
        <p className="mt-3 text-xs text-muted">
          Model: {latest.modelVersion}
          {baseline && " — placeholder baseline until the trained Random Forest / LSTM are deployed."}
        </p>
      )}
    </section>
  );
}

const fmt = (v: number | null | undefined) => (v == null ? "—" : String(Math.round(v)));

function Stat({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="rounded-md border border-line px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">
        {value}
        {unit && value !== "—" && <span className="ml-1 text-xs font-normal text-ink-2">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
