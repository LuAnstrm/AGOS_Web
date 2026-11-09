"use client";

import { useState } from "react";
import type { Alert, SensorNode } from "@/lib/api";
import { tierRank, tierVar } from "@/lib/tiers";
import { TierBadge } from "./TierBadge";

type Scope = "all" | "watch";

interface Props {
  alerts: Alert[];
  nodes: Record<string, SensorNode>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Ids that arrived live in this session (highlighted briefly). */
  freshIds: Set<string>;
}

/** Live, filterable list of five-tier alerts, newest first. */
export function AlertFeed({ alerts, nodes, selectedId, onSelect, freshIds }: Props) {
  const [scope, setScope] = useState<Scope>("all");
  const [onlySelected, setOnlySelected] = useState(false);
  const [lang, setLang] = useState<"en" | "fil">("en");

  const shown = alerts.filter(
    (a) =>
      (scope === "all" || tierRank(a.tier) >= tierRank("watch")) &&
      (!onlySelected || a.nodeId === selectedId),
  );

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
      active ? "border-ink bg-ink text-page" : "border-line text-ink-2 hover:bg-hover"
    }`;

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-line bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="mr-auto text-sm font-semibold">Alert feed</h2>
        <button className={chip(scope === "all")} onClick={() => setScope("all")}>
          All tiers
        </button>
        <button className={chip(scope === "watch")} onClick={() => setScope("watch")}>
          Watch and above
        </button>
        <button
          className={chip(onlySelected)}
          onClick={() => setOnlySelected((v) => !v)}
          disabled={!selectedId}
          aria-pressed={onlySelected}
        >
          Selected node
        </button>
        <button
          className={chip(false)}
          onClick={() => setLang((l) => (l === "en" ? "fil" : "en"))}
          aria-label="Switch alert language"
        >
          {lang === "en" ? "EN" : "FIL"}
        </button>
      </header>

      <ol className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        {shown.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted">No alerts match these filters.</li>
        )}
        {shown.map((a) => {
          const node = nodes[a.nodeId];
          const fresh = freshIds.has(a.id);
          return (
            <li key={a.id}>
              <button
                onClick={() => onSelect(a.nodeId)}
                className={`flex w-full gap-3 border-b border-line px-4 py-3 text-left transition-colors hover:bg-hover ${
                  a.nodeId === selectedId ? "bg-hover" : ""
                }`}
              >
                <span
                  aria-hidden
                  className="mt-1 w-1 shrink-0 self-stretch rounded-full"
                  style={{ background: tierVar(a.tier), opacity: fresh ? 1 : 0.7 }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <TierBadge tier={a.tier} lang={lang} />
                    {a.previousTier && (
                      <span className="text-xs text-muted">
                        from <TierBadge tier={a.previousTier} lang={lang} />
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted tabular">
                      {new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-ink-2">
                    {node?.name ?? a.nodeId}
                    {node?.barangay ? ` · ${node.barangay}` : ""}
                  </span>
                  <span className="mt-1 block text-sm leading-snug">
                    {lang === "en" ? a.messageEn : a.messageFil}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
