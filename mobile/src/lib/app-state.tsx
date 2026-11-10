import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { api, ApiError, type Alert, type SensorNode, type SeriesPoint, type User } from "./api";
import { WS_URL } from "./config";
import type { EvacCentre } from "./evac";
import { byDistance, distanceM, locate, type LocationState } from "./geo";
import { t, TIER_LABEL, type Locale } from "./i18n";
import { notify } from "./notify";
import { flush } from "./sos-queue";
import { secret, store } from "./storage";
import { tierRank, type Tier } from "./tiers";

/** Alerts for sensors within this distance of the user trigger a notification. */
const NOTIFY_RADIUS_M = 3000;
const TOKEN_KEY = "agos.token";
const CACHE_KEY = "agos.cache";
const LOCALE_KEY = "agos.locale";

interface Cache {
  nodes: SensorNode[];
  latest: Record<string, SeriesPoint>;
  alerts: Alert[];
  centres?: EvacCentre[];
  at: number;
}

export type LiveStatus = "connecting" | "live" | "offline";

interface AppValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  user: User | null;
  token: string | null;
  signIn: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, displayName: string) => Promise<User>;
  signOut: () => Promise<void>;
  nodes: SensorNode[];
  latest: Record<string, SeriesPoint>;
  alerts: Alert[];
  centres: EvacCentre[];
  /** When data was last received from the server (ms), null if never. */
  updatedAt: number | null;
  live: LiveStatus;
  location: LocationState;
  refreshLocation: (ask: boolean) => Promise<LocationState>;
  refresh: () => Promise<void>;
  ready: boolean;
}

const Ctx = createContext<AppValue | null>(null);

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [locale, setLocaleState] = useState<Locale>("fil");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [nodes, setNodes] = useState<SensorNode[]>([]);
  const [latest, setLatest] = useState<Record<string, SeriesPoint>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [centres, setCentres] = useState<EvacCentre[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [live, setLive] = useState<LiveStatus>("connecting");
  const [location, setLocation] = useState<LocationState>({ kind: "unknown" });

  // Latest values for callbacks that outlive a render (WebSocket handlers).
  const ref = useRef({ locale, location, nodes, token });
  useEffect(() => {
    ref.current = { locale, location, nodes, token };
  });

  // ---- startup: cached data first, so the app is useful offline -----------
  useEffect(() => {
    void (async () => {
      const [cache, savedLocale, savedToken] = await Promise.all([
        store.get<Cache>(CACHE_KEY),
        store.get<Locale>(LOCALE_KEY),
        secret.get(TOKEN_KEY),
      ]);
      if (cache) {
        setNodes(cache.nodes);
        setLatest(cache.latest);
        setAlerts(cache.alerts);
        setCentres(cache.centres ?? []);
        setUpdatedAt(cache.at);
      }
      if (savedLocale) setLocaleState(savedLocale);
      if (savedToken) {
        setToken(savedToken);
        try {
          setUser(await api.me(savedToken));
        } catch (e) {
          // Expired or revoked: forget it. Offline: keep it and try later.
          if (e instanceof ApiError && e.status === 401) {
            await secret.remove(TOKEN_KEY);
            setToken(null);
          }
        }
      }
      setReady(true);
      setLocation(await locate(true));
    })();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [ns, as, cs] = await Promise.all([api.nodes(), api.alerts(50), api.centres()]);
      const lasts = await Promise.all(
        ns.map((n) => api.latest(n.id).then((p) => [n.id, p] as const).catch(() => [n.id, null] as const)),
      );
      const lt = Object.fromEntries(lasts.filter(([, p]) => p)) as Record<string, SeriesPoint>;
      const at = Date.now();
      setNodes(ns);
      setAlerts(as);
      setCentres(cs);
      setLatest(lt);
      setUpdatedAt(at);
      await store.set(CACHE_KEY, { nodes: ns, latest: lt, alerts: as, centres: cs, at } satisfies Cache);
    } catch {
      // Offline: keep showing the cache.
    }
  }, []);

  // ---- live WebSocket, reconnecting with backoff --------------------------
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      setLive("connecting");
      ws = new WebSocket(WS_URL);
      ws.onopen = () => {
        retry = 0;
        setLive("live");
        void refresh(); // catch up on anything missed while offline
        void flush(ref.current.token); // and send any queued SOS
      };
      ws.onmessage = (m) => onMessage(String(m.data));
      ws.onclose = () => {
        if (closed) return;
        setLive("offline");
        const delay = Math.min(30_000, 1000 * 2 ** retry++);
        timer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws?.close();
    };

    const onMessage = (raw: string) => {
      let msg: { type: string; data: Record<string, unknown> };
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      if (msg.type === "reading") {
        const d = msg.data as {
          nodeId: string;
          recordedAt: string;
          rawCm: number;
          filteredCm: number;
          rateCmPerMin: number | null;
          riskClass: SeriesPoint["riskClass"];
          forecast: { h1Cm: number; h6Cm: number; h24Cm: number } | null;
          tier: Tier;
        };
        setLatest((m) => ({
          ...m,
          [d.nodeId]: {
            recordedAt: d.recordedAt,
            rawCm: d.rawCm,
            filteredCm: d.filteredCm,
            rateCmPerMin: d.rateCmPerMin,
            riskClass: d.riskClass,
            h1Cm: d.forecast?.h1Cm ?? null,
            h6Cm: d.forecast?.h6Cm ?? null,
            h24Cm: d.forecast?.h24Cm ?? null,
          },
        }));
        setNodes((ns) => ns.map((n) => (n.id === d.nodeId ? { ...n, currentTier: d.tier, lastSeenAt: d.recordedAt } : n)));
        setUpdatedAt(Date.now());
      } else if (msg.type === "centre") {
        const ct = (msg.data as { centre: EvacCentre }).centre;
        setCentres((cs) => cs.map((x) => (x.id === ct.id ? ct : x)));
      } else if (msg.type === "alert") {
        const a = msg.data as unknown as Alert & { notify: boolean };
        setAlerts((as) => (as.some((x) => x.id === a.id) ? as : [a, ...as].slice(0, 100)));
        if (a.notify && isNearUser(a.nodeId)) {
          const l = ref.current.locale;
          void notify(`AGOS · ${TIER_LABEL[l][a.tier]}`, l === "fil" ? a.messageFil : a.messageEn);
        }
      }
    };

    const isNearUser = (nodeId: string) => {
      const { location: loc, nodes: ns } = ref.current;
      if (loc.kind !== "ok") return true; // location unknown: better to over-notify
      const n = ns.find((x) => x.id === nodeId);
      if (!n || n.lat == null || n.lng == null) return true;
      return distanceM(loc.position, { lat: n.lat, lng: n.lng }) <= NOTIFY_RADIUS_M;
    };

    connect();
    // Reconnect right away when the app comes back to the foreground.
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && ws && ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CONNECTING) {
        if (timer) clearTimeout(timer);
        retry = 0;
        connect();
      }
    });
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      sub.remove();
      ws?.close();
    };
  }, [refresh]);

  // Keep retrying queued SOS every 15 s (cheap no-op when the queue is empty).
  useEffect(() => {
    const t = setInterval(() => void flush(ref.current.token), 15_000);
    return () => clearInterval(t);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    void store.set(LOCALE_KEY, l);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api.login(email, password);
    await secret.set(TOKEN_KEY, r.accessToken);
    setToken(r.accessToken);
    setUser(r.user);
    setLocaleState(r.user.locale);
    void flush(r.accessToken);
    return r.user;
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      await api.register({ email, password, displayName, locale: ref.current.locale });
      return signIn(email, password);
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    await secret.remove(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshLocation = useCallback(async (ask: boolean) => {
    const l = await locate(ask);
    setLocation(l);
    return l;
  }, []);

  const value = useMemo<AppValue>(
    () => ({
      locale,
      setLocale,
      user,
      token,
      signIn,
      register,
      signOut,
      nodes,
      latest,
      alerts,
      centres,
      updatedAt,
      live,
      location,
      refreshLocation,
      refresh,
      ready,
    }),
    [locale, setLocale, user, token, signIn, register, signOut, nodes, latest, alerts, centres, updatedAt, live, location, refreshLocation, refresh, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Nearest node to the user (or the most severe one when location is unknown). */
export function useMyArea() {
  const { nodes, location } = useApp();
  return useMemo(() => {
    const pos = location.kind === "ok" ? location.position : null;
    const ranked = byDistance(nodes, pos);
    if (!pos) ranked.sort((a, b) => tierRank(b.node.currentTier) - tierRank(a.node.currentTier));
    return { mine: ranked[0] ?? null, others: ranked.slice(1), hasLocation: pos != null };
  }, [nodes, location]);
}

/** Localised "updated 3 min ago". */
export function agoText(locale: Locale, at: number | null, now: number): string {
  if (at == null) return "—";
  const m = Math.max(0, Math.round((now - at) / 60_000));
  const prefix = t(locale, "updated");
  if (m < 1) return `${prefix}: ${locale === "fil" ? "ngayon lang" : "just now"}`;
  if (m < 60) return `${prefix}: ${m} min`;
  return `${prefix}: ${Math.floor(m / 60)} h ${m % 60} min`;
}
