"use client";

import { useEffect, useRef, useState } from "react";
import { API, type AlertEventData, type ReadingEventData, type SosEventData } from "./api";

export type LiveStatus = "connecting" | "live" | "reconnecting";

interface Handlers {
  onReading: (r: ReadingEventData) => void;
  onAlert: (a: AlertEventData) => void;
  onSos: (s: SosEventData) => void;
  /** Called on every (re)connect so callers can refetch what they missed. */
  onConnect?: () => void;
}

/**
 * Subscribes to the backend's Server-Sent Events stream (GET /events).
 * EventSource reconnects by itself; onConnect fires after each reconnect so
 * the dashboard can backfill anything published while it was offline.
 */
export function useLiveEvents(handlers: Handlers): LiveStatus {
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    // withCredentials sends the session cookie: /events is officer-only.
    const es = new EventSource(`${API}/events`, { withCredentials: true });
    es.onopen = () => {
      setStatus("live");
      ref.current.onConnect?.();
    };
    es.onerror = () => setStatus("reconnecting");
    es.addEventListener("reading", (e) =>
      ref.current.onReading(JSON.parse((e as MessageEvent).data) as ReadingEventData),
    );
    es.addEventListener("alert", (e) =>
      ref.current.onAlert(JSON.parse((e as MessageEvent).data) as AlertEventData),
    );
    es.addEventListener("sos", (e) =>
      ref.current.onSos(JSON.parse((e as MessageEvent).data) as SosEventData),
    );
    return () => es.close();
  }, []);

  return status;
}
