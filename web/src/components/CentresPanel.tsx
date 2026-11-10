"use client";

import { Building2, School, Warehouse } from "lucide-react";
import { useState } from "react";
import { updateCentre, type CentreStatus, type EvacCentre } from "@/lib/api";

const STATUS: { id: CentreStatus; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "full", label: "Full" },
  { id: "closed", label: "Closed" },
];

const KIND_ICON = { school: School, court: Warehouse, hall: Building2, other: Building2 } as const;

/**
 * Evacuation centres and their status. Officers set Open / Full / Closed;
 * citizens' apps stop recommending a centre the moment it is not Open.
 */
export function CentresPanel({
  centres,
  selectedId,
  onSelect,
  onUpdated,
}: {
  centres: EvacCentre[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdated: (c: EvacCentre) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = centres.filter((c) => c.status === "open").length;
  const placeholders = centres.some((c) => c.placeholder);

  const set = async (c: EvacCentre, status: CentreStatus) => {
    if (c.status === status) return;
    setBusy(c.id);
    setError(null);
    try {
      onUpdated(await updateCentre(c.id, status));
    } catch (e) {
      setError(`Couldn't update ${c.name}: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-4 py-2.5 text-xs text-ink-2">
        <span className="font-semibold text-ink">{open}</span> of {centres.length} open · citizens are only sent to open
        centres away from flooded sensors.
        {placeholders && (
          <span className="mt-1 block font-medium text-ink">
            ⚠ Placeholder locations — load the CDRRMO list with <code className="text-[11px]">npm run seed-centers</code>.
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="border-b border-line px-4 py-2 text-xs font-medium">
          {error}
        </p>
      )}
      <ul className="scroll-quiet min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {centres.map((c) => {
          const Icon = KIND_ICON[c.kind];
          return (
            <li key={c.id}>
              <div
                onClick={() => onSelect(c.id)}
                className={`cursor-pointer rounded-lg border px-3 py-2.5 transition-colors ${
                  c.id === selectedId ? "border-ink bg-hover" : "border-transparent hover:bg-hover"
                } ${c.status === "closed" ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{c.name}</span>
                    <span className="block text-xs text-muted">
                      {c.barangay ?? "—"}
                      {c.capacity ? ` · capacity ${c.capacity.toLocaleString()}` : ""}
                    </span>
                  </span>
                </div>
                <div
                  className="mt-2 flex overflow-hidden rounded-md border border-line text-xs font-semibold"
                  role="radiogroup"
                  aria-label={`Status of ${c.name}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {STATUS.map((s) => (
                    <button
                      key={s.id}
                      role="radio"
                      aria-checked={c.status === s.id}
                      disabled={busy === c.id}
                      onClick={() => void set(c, s.id)}
                      className={`flex-1 px-2 py-1 transition-colors disabled:opacity-50 ${
                        c.status === s.id ? "bg-ink text-page" : "text-ink-2 hover:bg-hover"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
