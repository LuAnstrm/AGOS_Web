"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import type { Alert, SensorNode } from "@/lib/api";
import { TIER_LABEL, tierRank, tierVar } from "@/lib/tiers";
import { Chip } from "./Panel";
import { TierBadge } from "./TierBadge";

interface Props {
  alerts: Alert[];
  nodes: Record<string, SensorNode>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Ids that arrived live in this session. */
  freshIds: Set<string>;
}

/** Five-tier alert timeline, newest first, with filters in one row above. */
export function AlertFeed({ alerts, nodes, selectedId, onSelect, freshIds }: Props) {
  const [scope, setScope] = useState<"all" | "watch">("all");
  const [onlySelected, setOnlySelected] = useState(false);
  const [lang, setLang] = useState<"en" | "fil">("en");

  const shown = alerts.filter(
    (a) =>
      (scope === "all" || tierRank(a.tier) >= tierRank("watch")) &&
      (!onlySelected || a.nodeId === selectedId),
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-4 py-2.5">
        <Chip active={scope === "all"} onClick={() => setScope("all")}>
          All tiers
        </Chip>
        <Chip active={scope === "watch"} onClick={() => setScope("watch")}>
          Watch +
        </Chip>
        <Chip active={onlySelected} onClick={() => setOnlySelected((v) => !v)} disabled={!selectedId}>
          Selected sensor
        </Chip>
        <span className="ml-auto flex overflow-hidden rounded-full border border-line text-xs font-semibold">
          {(["en", "fil"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`px-2.5 py-1 ${lang === l ? "bg-ink text-page" : "text-ink-2 hover:bg-hover"}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </span>
      </div>

      <ol className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-live="polite">
        {shown.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-muted">No alerts match these filters.</li>
        )}
        {shown.map((a) => {
          const node = nodes[a.nodeId];
          const fresh = freshIds.has(a.id);
          return (
            <li key={a.id}>
              <button
                onClick={() => onSelect(a.nodeId)}
                className={`group relative flex w-full gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-hover ${
                  a.nodeId === selectedId ? "bg-hover" : ""
                }`}
              >
                <span className="relative mt-0.5 flex flex-col items-center" aria-hidden>
                  <span
                    className={`h-3 w-3 rounded-full ring-4 ring-surface ${fresh ? "" : ""}`}
                    style={{ background: tierVar(a.tier) }}
                  />
                  <span className="mt-1 w-px flex-1 bg-line" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
                    {a.previousTier && (
                      <>
                        <span className="text-muted">{TIER_LABEL[a.previousTier][lang]}</span>
                        <ArrowRight className="h-3 w-3 text-muted" aria-label="to" />
                      </>
                    )}
                    <TierBadge tier={a.tier} lang={lang} />
                    {fresh && (
                      <span className="rounded bg-brand-soft px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-brand">
                        New
                      </span>
                    )}
                    <time className="ml-auto text-xs text-muted tabular" dateTime={a.createdAt}>
                      {new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </time>
                  </span>
                  <span className="mt-0.5 block text-xs font-medium text-ink-2">
                    {node?.name ?? a.nodeId}
                    {node?.barangay ? ` · ${node.barangay}` : ""}
                  </span>
                  <span className="mt-1 block text-[13px] leading-snug text-ink">
                    {lang === "en" ? a.messageEn : a.messageFil}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
