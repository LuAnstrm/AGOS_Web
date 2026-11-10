import { ArrowDownRight, ArrowRight, ArrowUpRight, BrainCircuit, MapPin } from "lucide-react";
import type { SensorNode, SeriesPoint } from "@/lib/api";
import { HIGH_FROM_CM, MODERATE_FROM_CM, RISK_LABEL } from "@/lib/tiers";
import { Panel } from "./Panel";
import { TierBadge } from "./TierBadge";

/** Selected sensor: current state, risk class, and the 1h / 6h / 24h outlook. */
export function MlPanel({ node, latest }: { node: SensorNode; latest: SeriesPoint | undefined }) {
  const baseline = latest?.modelVersion?.startsWith("baseline");
  const rate = latest?.rateCmPerMin;
  const depth = latest?.filteredCm ?? null;
  const TrendIcon = rate == null || Math.abs(rate) < 0.2 ? ArrowRight : rate > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <Panel
      icon={<MapPin />}
      title={node.name ?? node.id}
      meta={`${node.barangay ?? ""} · ${node.id}${node.source === "simulated" ? " · simulated" : ""}`}
      actions={<TierBadge tier={node.currentTier} />}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Water depth" value={fmt(depth)} unit="cm" big />
        <Stat
          label="Trend"
          value={rate == null ? "—" : Math.abs(rate) < 0.05 ? "0.0" : `${rate > 0 ? "+" : ""}${rate.toFixed(1)}`}
          unit="cm/min"
          icon={<TrendIcon className="h-4 w-4" aria-hidden />}
        />
        <Stat
          label="Risk class"
          value={latest?.riskClass ? RISK_LABEL[latest.riskClass] : "—"}
          sub={latest?.confidence != null ? `${Math.round(latest.confidence * 100)}% confidence` : undefined}
        />
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
          <BrainCircuit className="h-3.5 w-3.5" aria-hidden /> Forecast
        </div>
        <ol className="grid grid-cols-4 gap-2">
          {[
            ["Now", depth],
            ["In 1 h", latest?.h1Cm ?? null],
            ["In 6 h", latest?.h6Cm ?? null],
            ["In 24 h", latest?.h24Cm ?? null],
          ].map(([label, v], i) => (
            <li key={label as string} className="relative rounded-lg bg-surface-2 px-3 py-2">
              {i > 0 && (
                <ArrowRight className="absolute -left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted" aria-hidden />
              )}
              <div className="text-[11px] text-muted">{label as string}</div>
              <div className="text-base font-semibold tabular">
                {fmt(v as number | null)}
                {v != null && <span className="ml-0.5 text-[11px] font-normal text-ink-2">cm</span>}
              </div>
              <Band cm={v as number | null} />
            </li>
          ))}
        </ol>
      </div>

      {latest?.modelVersion && (
        <p className="mt-3 text-[11px] text-muted">
          Model <code className="rounded bg-surface-2 px-1 py-px">{latest.modelVersion}</code>
          {baseline && " — placeholder baseline until the trained Random Forest and LSTM are deployed."}
        </p>
      )}
    </Panel>
  );
}

/** Which depth band a value falls in (same thresholds as the classifier). */
function Band({ cm }: { cm: number | null }) {
  if (cm == null) return <div className="text-[11px] text-muted">&nbsp;</div>;
  const [label, color] =
    cm >= HIGH_FROM_CM
      ? ["High", "var(--tier-warning)"]
      : cm >= MODERATE_FROM_CM
        ? ["Moderate", "var(--tier-watch)"]
        : ["Low", "var(--tier-safe)"];
  return (
    <div className="flex items-center gap-1 text-[11px] text-ink-2">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </div>
  );
}

const fmt = (v: number | null | undefined) => (v == null ? "—" : String(Math.round(v)));

function Stat({
  label,
  value,
  unit,
  sub,
  icon,
  big,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  icon?: React.ReactNode;
  big?: boolean;
}) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2.5">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-0.5 flex items-center gap-1 font-bold tracking-tight tabular ${big ? "text-3xl" : "text-xl"}`}>
        {icon}
        {value}
        {unit && value !== "—" && <span className="ml-0.5 text-xs font-medium text-ink-2">{unit}</span>}
      </div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
