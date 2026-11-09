import { api, ApiError, OfflineError, type NewSos } from "./api";
import { store } from "./storage";

/**
 * SOS requests are written to the device FIRST, then sent. If there is no
 * connection the request stays queued and is retried automatically — the
 * person asking for help never has to press Send again. Each request carries
 * a clientId generated once, so a retry that reaches the server twice is
 * recognised as the same request (POST /sos is idempotent on clientId).
 *
 * In the hardware phase this queue is also where a Bluetooth Mesh relay
 * would pick requests up; for now delivery is a direct call to the backend.
 */
const KEY = "agos.sosQueue";

export interface QueuedSos {
  sos: NewSos;
  attempts: number;
  lastError: string | null;
}

export async function queued(): Promise<QueuedSos[]> {
  return (await store.get<QueuedSos[]>(KEY)) ?? [];
}

export async function enqueue(sos: NewSos): Promise<void> {
  const q = await queued();
  if (!q.some((x) => x.sos.clientId === sos.clientId)) {
    q.push({ sos, attempts: 0, lastError: null });
    await store.set(KEY, q);
  }
}

export type FlushResult = { sent: number; remaining: number; rejected: string[] };

let flushing: Promise<FlushResult> | null = null;

/** Tries to send every queued request. Safe to call often; runs one at a time. */
export function flush(token: string | null): Promise<FlushResult> {
  flushing ??= (async () => {
    try {
      const q = await queued();
      if (!token || q.length === 0) return { sent: 0, remaining: q.length, rejected: [] };
      const keep: QueuedSos[] = [];
      const rejected: string[] = [];
      let sent = 0;
      let offline = false;
      for (const item of q) {
        if (offline) {
          keep.push(item);
          continue;
        }
        try {
          await api.sendSos(token, item.sos);
          sent++;
        } catch (e) {
          if (e instanceof OfflineError || (e instanceof ApiError && (e.status >= 500 || e.status === 401))) {
            // Offline, server trouble, or an expired sign-in: keep it and retry later.
            offline = e instanceof OfflineError;
            keep.push({ ...item, attempts: item.attempts + 1, lastError: (e as Error).message });
          } else {
            // The server refused the request itself (400): retrying won't help.
            rejected.push((e as Error).message);
          }
        }
      }
      await store.set(KEY, keep);
      return { sent, remaining: keep.length, rejected };
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}
