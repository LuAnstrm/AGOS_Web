"use client";

import { useCallback, useEffect, useState } from "react";
import { API, getMe, signIn, signOut, type Officer } from "@/lib/api";
import { Dashboard } from "./Dashboard";

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
      <div className="max-w-sm rounded-lg border border-line bg-surface p-6 text-center text-sm">{children}</div>
    </main>
  );
}

function SignIn({ notice, onSignedIn }: { notice?: string; onSignedIn: (u: Officer) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const field = "mt-1 w-full rounded-md border border-line bg-page px-3 py-2 text-sm outline-none focus:border-ink";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-line bg-surface p-6">
        <h1 className="text-lg font-semibold">AGOS flood monitoring</h1>
        <p className="mt-0.5 text-xs text-muted">DRRMO officer sign-in · Malolos City pilot</p>
        {notice && <p className="mt-4 rounded-md border border-line px-3 py-2 text-sm">{notice}</p>}
        <label className="mt-5 block text-sm font-medium">
          Email
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-md bg-ink px-3 py-2 text-sm font-semibold text-page disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-4 text-xs text-muted">
          Officer accounts are issued by the CDRRMO administrator. There is no self sign-up.
        </p>
      </form>
    </main>
  );
}
