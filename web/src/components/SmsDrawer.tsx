"use client";

import { Loader2, MessageSquareText, Send, TriangleAlert, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  sms,
  smsParts,
  type SensorNode,
  type SmsAudience,
  type SmsBroadcast,
  type SmsLogItem,
  type SmsPreview,
  type SmsSummary,
} from "@/lib/api";

const field =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft";

/**
 * SMS for people without the app.
 *  - Automatic: Warning / Critical escalations are texted by the system;
 *    they show up in "Recent messages" — nobody has to press anything.
 *  - Broadcast: composed here, previewed, then confirmed with the exact
 *    recipient count.
 */
export function SmsDrawer({ open, onClose, nodes }: { open: boolean; onClose: () => void; nodes: SensorNode[] }) {
  const [summary, setSummary] = useState<SmsSummary | null>(null);
  const [history, setHistory] = useState<SmsBroadcast[]>([]);
  const [log, setLog] = useState<SmsLogItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, b, m] = await Promise.all([sms.summary(), sms.broadcasts(), sms.messages()]);
      setSummary(s);
      setHistory(b);
      setLog(m);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1200] flex justify-end" role="dialog" aria-modal="true" aria-label="SMS alerts">
      <button className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" aria-label="Close" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[560px] flex-col border-l border-line bg-page shadow-pop">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-5 py-4">
          <MessageSquareText className="h-5 w-5 text-brand" aria-hidden />
          <div className="leading-tight">
            <h2 className="text-base font-semibold">SMS alerts</h2>
            <p className="text-xs text-muted">For residents without the app or mobile data</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="ml-auto grid h-8 w-8 place-items-center rounded-md hover:bg-hover">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="scroll-quiet flex-1 space-y-4 overflow-y-auto p-5">
          {summary?.driver === "console" && (
            <p className="flex gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-xs">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--tier-advisory)" }} aria-hidden />
              <span>
                <b>Development mode — nothing is actually sent.</b> Messages are recorded below as “simulated”. Set{" "}
                <code>SMS_DRIVER=semaphore</code> and an API key on the backend to send real SMS.
              </span>
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-lg border border-line px-3 py-2 text-sm">
              {error}
            </p>
          )}

          <section className="grid grid-cols-3 gap-2">
            <Stat label="Subscribers" value={summary?.active ?? "—"} />
            <Stat label="Filipino / English" value={summary ? `${summary.fil} / ${summary.en}` : "—"} />
            <Stat label="Registered in person" value={summary?.viaOfficer ?? "—"} />
          </section>

          <section className="card p-4 text-xs text-ink-2">
            <b className="text-ink">Automatic:</b> when a sensor rises to <b>Warning</b> or <b>Critical</b>, subscribers within
            3 km get one SMS in their language — no action needed. Lower tiers go to the app only.
          </section>

          <Composer nodes={nodes} onSent={load} />
          <Register onAdded={load} />

          <section className="card">
            <h3 className="border-b border-line px-4 py-3 text-sm font-semibold">Broadcast history</h3>
            {history.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted">No broadcasts yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {history.map((b) => (
                  <li key={b.id} className="px-4 py-3 text-xs">
                    <div className="flex items-center gap-2">
                      <b className="text-sm">{b.recipients} people</b>
                      <span className="text-muted">
                        · {b.audience.kind === "all" ? "all subscribers" : `near ${b.audience.nodeId}`} · {b.segments} SMS parts
                        {b.failed ? ` · ${b.failed} failed` : ""}
                      </span>
                      <time className="ml-auto text-muted">{new Date(b.createdAt).toLocaleString()}</time>
                    </div>
                    <p className="mt-1 text-ink">{b.messageFil}</p>
                    <p className="text-ink-2">{b.messageEn}</p>
                    <p className="mt-1 text-muted">Sent by {b.createdBy}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h3 className="border-b border-line px-4 py-3 text-sm font-semibold">Recent messages</h3>
            {log.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted">No messages yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {log.slice(0, 25).map((m) => (
                  <li key={m.id} className="flex gap-3 px-4 py-2.5 text-xs">
                    <span
                      className={`h-fit rounded px-1.5 py-px font-semibold uppercase ${
                        m.kind === "auto" ? "bg-ink text-page" : "bg-surface-2 text-ink-2"
                      }`}
                    >
                      {m.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex gap-2 text-muted">
                        <span className="tabular">{m.phone}</span>
                        <span>· {m.status}</span>
                        <time className="ml-auto">{new Date(m.createdAt).toLocaleTimeString()}</time>
                      </span>
                      <span className="block truncate text-ink">{m.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card px-3 py-2.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function Counter({ text }: { text: string }) {
  const p = smsParts(text);
  return (
    <span className={`text-[11px] ${p.segments > 1 || p.unicode ? "font-semibold text-ink" : "text-muted"}`}>
      {[...text].length} chars · {p.segments} SMS{p.segments > 1 ? " parts" : ""}
      {p.unicode && " · special characters make each part shorter (70)"}
    </span>
  );
}

function Composer({ nodes, onSent }: { nodes: SensorNode[]; onSent: () => void }) {
  const [kind, setKind] = useState<"all" | "near">("all");
  const [nodeId, setNodeId] = useState("");
  const [radiusM, setRadiusM] = useState(3000);
  const [en, setEn] = useState("");
  const [fil, setFil] = useState("");
  const [preview, setPreview] = useState<SmsPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const audience: SmsAudience =
    kind === "all" ? { kind: "all" } : { kind: "near", nodeId: nodeId || nodes[0]?.id || "", radiusM, includeUnlocated: false };

  // Any edit invalidates the preview: the officer must preview what is sent.
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPreview(null);
  };

  const doPreview = async () => {
    setBusy(true);
    setMsg(null);
    try {
      setPreview(await sms.preview({ audience, messageEn: en.trim(), messageFil: fil.trim() }));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doSend = async () => {
    if (!preview) return;
    setBusy(true);
    setMsg(null);
    try {
      const b = await sms.broadcast({ audience, messageEn: en.trim(), messageFil: fil.trim(), confirmRecipients: preview.recipients });
      setMsg(`Sent to ${b.recipients} people${b.failed ? ` (${b.failed} failed)` : ""}.`);
      setEn("");
      setFil("");
      setPreview(null);
      onSent();
    } catch (e) {
      setMsg((e as Error).message);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Send className="h-4 w-4 text-muted" aria-hidden /> New broadcast
      </h3>

      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={kind === "all"} onChange={() => edit(setKind)("all")} /> All subscribers
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={kind === "near"} onChange={() => edit(setKind)("near")} /> Near a sensor
        </label>
      </div>
      {kind === "near" && (
        <div className="mb-3 flex gap-2">
          <select className={field} value={nodeId || nodes[0]?.id || ""} onChange={(e) => edit(setNodeId)(e.target.value)}>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name ?? n.id}
              </option>
            ))}
          </select>
          <select className={`${field} w-32`} value={radiusM} onChange={(e) => edit(setRadiusM)(Number(e.target.value))}>
            {[1000, 3000, 5000, 10000].map((r) => (
              <option key={r} value={r}>
                within {r / 1000} km
              </option>
            ))}
          </select>
        </div>
      )}

      <label className="block text-xs font-medium">
        Filipino
        <textarea className={`${field} mt-1 h-20 resize-none`} maxLength={459} value={fil} onChange={(e) => edit(setFil)(e.target.value)} placeholder="AGOS: ..." />
      </label>
      <Counter text={fil} />
      <label className="mt-2 block text-xs font-medium">
        English
        <textarea className={`${field} mt-1 h-20 resize-none`} maxLength={459} value={en} onChange={(e) => edit(setEn)(e.target.value)} placeholder="AGOS: ..." />
      </label>
      <Counter text={en} />

      {preview ? (
        <div className="mt-3 rounded-lg border border-ink/30 bg-surface-2 p-3 text-sm">
          <p>
            <b>{preview.recipients} people</b> ({preview.fil.recipients} Filipino, {preview.en.recipients} English) ·{" "}
            {preview.totalSegments} SMS parts{preview.driver === "console" ? " · development mode, nothing really sent" : ""}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => void doSend()}
              disabled={busy || preview.recipients === 0}
              className="flex items-center gap-2 rounded-lg bg-[var(--tier-warning)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send to {preview.recipients} people
            </button>
            <button onClick={() => setPreview(null)} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-hover">
              Edit
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => void doPreview()}
          disabled={busy || !en.trim() || !fil.trim()}
          className="mt-3 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-page disabled:opacity-40"
        >
          Preview recipients
        </button>
      )}
      {msg && <p className="mt-2 text-sm font-medium">{msg}</p>}
    </section>
  );
}

function Register({ onAdded }: { onAdded: () => void }) {
  const [phone, setPhone] = useState("");
  const [locale, setLocale] = useState<"fil" | "en">("fil");
  const [barangay, setBarangay] = useState("");
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const add = async () => {
    setMsg(null);
    try {
      const r = await sms.addSubscriber({ phone, locale, barangay: barangay.trim() || undefined, consentConfirmed: true });
      setMsg(`Registered ${r.phone}.`);
      setPhone("");
      setBarangay("");
      setConsent(false);
      onAdded();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <details className="card p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
        <UserPlus className="h-4 w-4 text-muted" aria-hidden /> Register a resident in person
      </summary>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input className={field} placeholder="0917 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        <input className={field} placeholder="Barangay (optional)" value={barangay} onChange={(e) => setBarangay(e.target.value)} />
        <select className={field} value={locale} onChange={(e) => setLocale(e.target.value as "fil" | "en")}>
          <option value="fil">Filipino</option>
          <option value="en">English</option>
        </select>
      </div>
      <label className="mt-3 flex items-start gap-2 text-xs">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        The resident agreed to receive SMS flood alerts and to AGOS keeping their number for this purpose (Data Privacy
        Act). They can opt out at any time.
      </label>
      <button
        onClick={() => void add()}
        disabled={!consent || phone.trim().length < 10}
        className="mt-3 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-page disabled:opacity-40"
      >
        Register
      </button>
      {msg && <p className="mt-2 text-sm font-medium">{msg}</p>}
    </details>
  );
}
