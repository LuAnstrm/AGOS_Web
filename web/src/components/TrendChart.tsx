"use client";

import { Waves } from "lucide-react";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint } from "@/lib/api";
import { HIGH_FROM_CM, MODERATE_FROM_CM } from "@/lib/tiers";
import { useCssVars } from "@/lib/useCssVars";

const VARS = ["series-filtered", "series-raw", "grid", "axis", "muted", "ink", "ink-2", "surface"] as const;

interface Row {
  t: number;
  raw: number;
  filtered: number | null;
  rejected: boolean;
}

const hhmm = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Water level per node: raw ultrasonic reading vs. Kalman-filtered estimate. */
export function TrendChart({ points }: { points: SeriesPoint[] }) {
  const c = useCssVars(VARS);
  const [view, setView] = useState<"chart" | "table">("chart");
  const rows: Row[] = points.map((p) => ({
    t: Date.parse(p.recordedAt),
    raw: p.rawCm,
    filtered: p.filteredCm,
    rejected: !!p.rejected,
  }));
  const last = rows.length - 1;
  const maxY = Math.max(HIGH_FROM_CM + 20, ...rows.map((r) => Math.max(r.raw, r.filtered ?? 0)));
  const step = maxY <= 120 ? 25 : 50;
  const top = Math.ceil(maxY / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  // End labels: whichever series ends higher gets its label nudged up, the
  // other down, so they don't collide when the two values are close.
  const end = rows[last];
  const rawAbove = end ? end.raw >= (end.filtered ?? 0) : true;

  const endLabel = (text: string, color: string, above: boolean) =>
    function EndLabel(props: { index?: number; x?: number | string; y?: number | string }) {
      return props.index === last ? (
        <text x={Number(props.x) + 8} y={Number(props.y)} dy={above ? -3 : 11} fontSize={12} fill={c["ink-2"]}>
          <tspan fill={color}>● </tspan>
          {text}
        </text>
      ) : null;
    };

  return (
    <section className="card p-4">
      <header className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Waves className="h-4 w-4 text-muted" aria-hidden />Water level, last 3 h (cm)</h2>
        <Legend color="var(--series-filtered)" label="Filtered (EKF)" />
        <Legend color="var(--series-raw)" label="Raw sensor" />
        <span className="flex items-center gap-1.5 text-xs text-ink-2">
          <svg width="10" height="10" aria-hidden>
            <circle cx="5" cy="5" r="4" fill="none" stroke="var(--series-raw)" strokeWidth="2" />
          </svg>
          Rejected as outlier
        </span>
        <div className="ml-auto flex overflow-hidden rounded-md border border-line text-xs">
          {(["chart", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`px-2.5 py-1 capitalize ${view === v ? "bg-ink text-page" : "text-ink-2 hover:bg-hover"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">No readings yet for this node.</p>
      ) : view === "chart" ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 96, bottom: 4, left: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={hhmm}
                stroke={c.axis}
                tick={{ fill: c.muted, fontSize: 11 }}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={[0, top]}
                ticks={ticks}
                stroke={c.axis}
                tick={{ fill: c.muted, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <ReferenceLine
                y={MODERATE_FROM_CM}
                stroke={c.axis}
                label={{ value: "Moderate", position: "insideTopLeft", fill: c.muted, fontSize: 11 }}
              />
              <ReferenceLine
                y={HIGH_FROM_CM}
                stroke={c.axis}
                label={{ value: "High", position: "insideTopLeft", fill: c.muted, fontSize: 11 }}
              />
              <Tooltip
                cursor={{ stroke: c.muted, strokeWidth: 1 }}
                content={(p) => <ChartTooltip active={p.active} payload={p.payload} />}
                isAnimationActive={false}
              />
              <Line
                dataKey="raw"
                stroke={c["series-raw"]}
                strokeWidth={2}
                strokeOpacity={0.75}
                type="linear"
                isAnimationActive={false}
                dot={(d: { cx?: number; cy?: number; payload?: Row; index?: number }) =>
                  d.payload?.rejected ? (
                    <circle
                      key={`rej-${d.index}`}
                      cx={d.cx}
                      cy={d.cy}
                      r={4}
                      fill={c.surface}
                      stroke={c["series-raw"]}
                      strokeWidth={2}
                    />
                  ) : (
                    <g key={`no-${d.index}`} />
                  )
                }
                activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }}
                label={endLabel("Raw", c["series-raw"], rawAbove)}
              />
              <Line
                dataKey="filtered"
                stroke={c["series-filtered"]}
                strokeWidth={2}
                type="monotone"
                dot={false}
                isAnimationActive={false}
                connectNulls
                activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }}
                label={endLabel("Filtered", c["series-filtered"], !rawAbove)}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ReadingsTable rows={rows} />
      )}
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-2">
      <span aria-hidden className="inline-block h-0.5 w-4 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload as Row;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm">
      <div className="mb-1 font-medium tabular">{new Date(r.t).toLocaleTimeString()}</div>
      <TipRow color="var(--series-filtered)" label="Filtered" value={r.filtered} />
      <TipRow color="var(--series-raw)" label="Raw" value={r.raw} />
      {r.rejected && <div className="mt-1 text-muted">Raw reading rejected as outlier</div>}
    </div>
  );
}

function TipRow({ color, label, value }: { color: string; label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="text-ink-2">{label}</span>
      <span className="ml-auto pl-4 font-medium tabular">{value == null ? "—" : `${value.toFixed(1)} cm`}</span>
    </div>
  );
}

function ReadingsTable({ rows }: { rows: Row[] }) {
  return (
    <div className="scroll-quiet max-h-64 overflow-y-auto">
      <table className="w-full text-left text-sm tabular">
        <thead className="sticky top-0 bg-surface text-xs text-muted">
          <tr>
            <th className="py-1.5 font-medium">Time</th>
            <th className="py-1.5 text-right font-medium">Raw (cm)</th>
            <th className="py-1.5 text-right font-medium">Filtered (cm)</th>
            <th className="py-1.5 pl-4 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((r) => (
            <tr key={r.t} className="border-t border-line">
              <td className="py-1.5">{new Date(r.t).toLocaleTimeString()}</td>
              <td className="py-1.5 text-right">{r.raw.toFixed(1)}</td>
              <td className="py-1.5 text-right">{r.filtered?.toFixed(1) ?? "—"}</td>
              <td className="py-1.5 pl-4 text-xs text-muted">{r.rejected ? "outlier rejected" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
