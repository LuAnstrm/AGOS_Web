"use client";

import { LogOut, MessageSquareText, Radio, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import type { Officer } from "@/lib/api";
import type { LiveStatus } from "@/lib/useLiveEvents";
import { Wordmark } from "./Logo";

export function TopBar({
  officer,
  status,
  onSignOut,
  onOpenSms,
}: {
  officer: Officer;
  status: LiveStatus;
  onSignOut: () => void;
  onOpenSms: () => void;
}) {
  return (
    <header className="sticky top-0 z-[1100] border-b border-line bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-4 px-4 lg:px-6">
        <Wordmark sub="Flood Operations · Malolos City" />
        <span className="hidden rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-2 md:inline">
          Simulation phase
        </span>
        <div className="ml-auto flex items-center gap-3">
          <Clock />
          <LivePill status={status} />
          <button
            onClick={onOpenSms}
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-hover"
          >
            <MessageSquareText className="h-3.5 w-3.5" aria-hidden /> SMS
          </button>
          <div className="hidden h-6 w-px bg-line sm:block" />
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand"
            >
              {initials(officer.displayName)}
            </span>
            <span className="hidden text-sm leading-tight sm:block">
              <span className="block font-medium">{officer.displayName}</span>
              <span className="block text-[11px] text-muted">DRRMO officer</span>
            </span>
            <button
              onClick={onSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="ml-1 grid h-8 w-8 place-items-center rounded-md text-ink-2 hover:bg-hover"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function LivePill({ status }: { status: LiveStatus }) {
  const live = status === "live";
  return (
    <span
      role="status"
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        live ? "border-line text-ink" : "border-line text-muted"
      }`}
    >
      {live ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--tier-safe)] opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--tier-safe)]" />
          </span>
          <Radio className="h-3.5 w-3.5" aria-hidden /> Live
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5" aria-hidden />
          {status === "connecting" ? "Connecting…" : "Reconnecting…"}
        </>
      )}
    </span>
  );
}

/** Local time (Asia/Manila), the reference for every timestamp on the page. */
function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (!now) return <span className="hidden w-[132px] md:block" />;
  return (
    <span className="hidden text-right leading-tight md:block">
      <span className="block text-sm font-semibold tabular">
        {now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Manila" })}
      </span>
      <span className="block text-[11px] text-muted">
        {now.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Manila" })} · PHT
      </span>
    </span>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
