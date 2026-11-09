// Subscribes to the backend's realtime channels the way the two client apps
// will — WebSocket (mobile) and Server-Sent Events (web) — prints alerts as
// they arrive, and reports ingestion → client delivery latency per channel.
//
//   node src/listen.ts                 # until Ctrl+C
//   node src/listen.ts --seconds 40    # stop after 40 s, print summary
//   node src/listen.ts --nodes A,B     # only these nodes
//
// Exit code 1 if any event took longer than --target-ms (default 2000).

import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    seconds: { type: 'string', default: '0' },
    nodes: { type: 'string' },
    'target-ms': { type: 'string', default: '2000' },
  },
});

const api = (process.env.AGOS_API ?? 'http://localhost:3000').replace(/\/$/, '');
const qs = args.nodes ? `?nodes=${encodeURIComponent(args.nodes)}` : '';
const targetMs = Number(args['target-ms']);

type Channel = 'ws' | 'sse';
const latency: Record<Channel, number[]> = { ws: [], sse: [] };
const alerts: Record<Channel, string[]> = { ws: [], sse: [] };

interface Envelope {
  type: string;
  data: {
    nodeId?: string;
    receivedAt?: string;
    tier?: string;
    previousTier?: string | null;
    messageEn?: string;
    messageFil?: string;
    notify?: boolean;
  };
}

function onEvent(ch: Channel, ev: Envelope) {
  if (ev.type !== 'reading' && ev.type !== 'alert') return;
  const ms = Date.now() - Date.parse(ev.data.receivedAt!);
  latency[ch].push(ms);
  if (ev.type === 'alert') {
    const d = ev.data;
    alerts[ch].push(`${d.nodeId}:${d.tier}`);
    if (ch === 'ws') {
      console.log(
        `${new Date().toISOString().slice(11, 19)}  ${d.nodeId!.padEnd(18)} ${(d.previousTier ?? '-').padStart(8)} → ${d.tier!.padEnd(8)} ${d.notify ? '🔔' : '  '} ${ms}ms`,
      );
      console.log(`    EN  ${d.messageEn}\n    FIL ${d.messageFil}`);
    }
  }
}

// WebSocket (Node 22+ has a global WebSocket client, like React Native)
const ws = new WebSocket(api.replace(/^http/, 'ws') + '/ws' + qs);
ws.addEventListener('message', (m) => onEvent('ws', JSON.parse(String(m.data)) as Envelope));
ws.addEventListener('error', () => {
  console.error(`WebSocket error at ${api}/ws`);
  process.exit(1);
});

// SSE, parsed by hand from a fetch stream (same wire format EventSource reads)
const sseAbort = new AbortController();
void (async () => {
  try {
    const res = await fetch(`${api}/events${qs}`, { signal: sseAbort.signal });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const decoder = new TextDecoder();
    let buf = '';
    for await (const chunk of res.body) {
      buf += decoder.decode(chunk as Uint8Array, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        let type = 'message';
        let data = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) type = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (data) onEvent('sse', { type, data: JSON.parse(data) });
      }
    }
  } catch (e) {
    if (!sseAbort.signal.aborted) {
      console.error(`SSE error at ${api}/events: ${(e as Error).message}`);
      process.exit(1);
    }
  }
})();

console.log(`listening on ${api}/ws and ${api}/events${qs ? ' ' + qs : ''}`);

function pct(xs: number[], p: number) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

function finish() {
  ws.close();
  sseAbort.abort();
  console.log('\nchannel  events   p50    p95    max   (ingestion → client, ms)');
  let worst = 0;
  for (const ch of ['ws', 'sse'] as const) {
    const xs = latency[ch];
    const max = xs.length ? Math.max(...xs) : NaN;
    worst = Math.max(worst, max || 0);
    console.log(
      `${ch.padEnd(8)} ${String(xs.length).padStart(6)} ${String(pct(xs, 50)).padStart(5)} ${String(pct(xs, 95)).padStart(6)} ${String(max).padStart(6)}`,
    );
  }
  const same = alerts.ws.join() === alerts.sse.join();
  console.log(`alerts: ws ${alerts.ws.length}, sse ${alerts.sse.length} — ${same ? 'identical on both channels' : 'MISMATCH between channels'}`);
  const ok = worst <= targetMs && same && latency.ws.length > 0;
  console.log(ok ? `PASS: every event delivered within ${targetMs} ms` : `FAIL`);
  process.exit(ok ? 0 : 1);
}

process.on('SIGINT', finish);
if (Number(args.seconds) > 0) setTimeout(finish, Number(args.seconds) * 1000);
