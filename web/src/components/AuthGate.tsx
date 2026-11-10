"use client";

import { useCallback, useEffect, useState } from "react";
import { API, getMe, signIn, signOut, type Officer } from "@/lib/api";
import { Activity, BellRing, Eye, EyeOff, Info, LifeBuoy, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { Dashboard } from "./Dashboard";
import { LogoMark, Wordmark } from "./Logo";

type State =
  | { kind: "checking" }
  | { kind: "signed-out"; notice?: string }
  | { kind: "not-officer"; user: Officer }
  | { kind: "officer"; user: Officer }
  | { kind: "unreachable" };

/**
 * The DRRMO dashboard is for officers only. Checks the session on load,
 * shows sign-in when there is none, and returns to sign-in when the session
 * expires mid-shift.
 */
export function AuthGate() {
  const [state, setState] = useState<State>({ kind: "checking" });

  const check = useCallback(async () => {
    try {
      const user = await getMe();
      if (!user) setState({ kind: "signed-out" });
      else if (user.role !== "officer") setState({ kind: "not-officer", user });
      else setState({ kind: "officer", user });
    } catch {
      setState({ kind: "unreachable" });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((user) => {
        if (cancelled) return;
        if (!user) setState({ kind: "signed-out" });
        else if (user.role !== "officer") setState({ kind: "not-officer", user });
        else setState({ kind: "officer", user });
      })
      .catch(() => !cancelled && setState({ kind: "unreachable" }));
    return () => {
      cancelled = true;
    };
  }, []);

  const doSignOut = async () => {
    await signOut().catch(() => undefined);
    setState({ kind: "signed-out" });
  };

  switch (state.kind) {
    case "checking":
      return <Centered>Checking your session…</Centered>;
    case "unreachable":
      return (
        <Centered>
          <p>Can&apos;t reach the AGOS backend at {API}.</p>
          <button className="mt-3 rounded-md border border-line px-3 py-1.5 text-sm hover:bg-hover" onClick={check}>
            Try again
          </button>
        </Centered>
      );
    case "not-officer":
      return (
        <Centered>
          <p className="font-medium">This dashboard is for DRRMO officers.</p>
          <p className="mt-1 text-sm text-ink-2">
            You&apos;re signed in as {state.user.displayName}, a citizen account. Use the AGOS mobile app.
          </p>
          <button className="mt-3 rounded-md border border-line px-3 py-1.5 text-sm hover:bg-hover" onClick={doSignOut}>
            Sign out
          </button>
        </Centered>
      );
    case "signed-out":
      return (
        <SignIn
          notice={state.notice}
          onSignedIn={(user) =>
            setState(user.role === "officer" ? { kind: "officer", user } : { kind: "not-officer", user })
          }
        />
      );
    case "officer":
      return (
        <Dashboard
          officer={state.user}
          onSignOut={doSignOut}
          onSessionExpired={() =>
            setState({ kind: "signed-out", notice: "Your session ended. Please sign in again." })
          }
        />
      );
  }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="card w-full max-w-sm p-8 text-center text-sm">
        <div className="mb-4 flex justify-center">
          <LogoMark size={40} />
        </div>
        {children}
      </div>
    </main>
  );
}

function SignIn({ notice, onSignedIn }: { notice?: string; onSignedIn: (u: Officer) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await signIn(email, password));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field =
    "mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none transition-shadow focus:border-brand focus:ring-4 focus:ring-brand-soft";

  return (
    <main className="grid min-h-screen flex-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-[#0a3d6e] p-12 text-white lg:flex lg:flex-col">
        <WavePattern />
        <div className="relative flex items-center gap-3">
          <LogoMark size={40} />
          <span>
            <span className="block text-lg font-bold tracking-tight">AGOS</span>
            <span className="block text-xs text-white/70">Flood Operations · Malolos City</span>
          </span>
        </div>
        <div className="relative mt-auto max-w-md">
          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            Every sensor, every alert, every call for help — on one screen.
          </h1>
          <ul className="mt-8 space-y-4 text-sm text-white/85">
            {[
              [Activity, "Live water levels from IoT nodes, filtered for wind, debris and heat."],
              [BellRing, "Five-tier alerts in English and Filipino, pushed in under two seconds."],
              [LifeBuoy, "SOS requests from the app and mesh network, triaged and tracked to resolution."],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof Activity;
              return (
                <li key={i} className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10">
                    <I className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="pt-1.5">{text as string}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <p className="relative mt-12 text-xs text-white/60">BulSU ALAB COLLAB IoTLab · Malolos City CDRRMO pilot</p>
      </section>

      {/* Form */}
      <section className="flex items-center justify-center p-6 sm:p-12">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Wordmark sub="Flood Operations · Malolos City" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Officer sign-in</h2>
          <p className="mt-1 text-sm text-ink-2">Sign in with your CDRRMO-issued account.</p>

          {notice && (
            <p className="mt-5 flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
              {notice}
            </p>
          )}

          <label className="mt-6 block text-sm font-medium">
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.ph"
              className={field}
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Password
            <span className="relative block">
              <input
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${field} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 mt-[3px] grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-hover"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          {error && (
            <p role="alert" className="mt-4 flex items-start gap-2 text-sm font-medium">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--tier-warning)" }} aria-hidden />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-brand-ink shadow-card transition-opacity hover:opacity-95 disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>

          <p className="mt-6 flex items-start gap-2 text-xs text-muted">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            Accounts are issued by the CDRRMO administrator. There is no self sign-up. Sessions end after one 8-hour shift.
          </p>
        </form>
      </section>
    </main>
  );
}

function WavePattern() {
  return (
    <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.12]" preserveAspectRatio="none" viewBox="0 0 800 800">
      {Array.from({ length: 14 }, (_, i) => (
        <path
          key={i}
          d={`M-50 ${120 + i * 50} C 150 ${80 + i * 50}, 250 ${170 + i * 50}, 450 ${120 + i * 50} S 750 ${80 + i * 50}, 850 ${120 + i * 50}`}
          fill="none"
          stroke="#fff"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}
