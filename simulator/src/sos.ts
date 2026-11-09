// Simulated distress requests, standing in for the Bluetooth Mesh SOS flow
// until the mesh firmware exists. Each request lands within a few hundred
// metres of a sensor node; some are "relayed" twice to exercise dedup.
//
//   node src/sos.ts                       # 5 requests, one every 3 s
//   node src/sos.ts --count 10 --interval 1
//
// All names and phone numbers are obviously fake test data.

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import type { NodeConfig } from './node.ts';

const { values: args } = parseArgs({
  options: {
    count: { type: 'string', default: '5' },
    interval: { type: 'string', default: '3' },
    config: {
      type: 'string',
      default: new URL('../nodes.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    },
  },
});

const api = (process.env.AGOS_API ?? 'http://localhost:3000').replace(/\/$/, '');
// Sent as the mesh gateway would: with the device key, no user account.
const deviceKey = process.env.AGOS_DEVICE_KEY ?? 'agos-dev-device-key';
const { nodes } = JSON.parse(readFileSync(args.config!, 'utf8')) as { nodes: NodeConfig[] };

const NEEDS = ['medical', 'elderly', 'children', 'pwd', 'pregnant', 'trapped'] as const;
const MESSAGES = [
  'Tubig hanggang dibdib, nasa bubong kami',
  'May matanda kaming kasama, hindi makalakad',
  'Water inside the house, we are on the second floor',
  'Kailangan ng bangka, may mga bata',
  'Stuck on the roof, phone battery low',
  null,
];

const pick = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];

function makeRequest(i: number) {
  const n = pick(nodes);
  // Within ~400 m of the node (1e-3 deg ≈ 110 m).
  const lat = n.lat + (Math.random() - 0.5) * 0.007;
  const lng = n.lng + (Math.random() - 0.5) * 0.007;
  const needs = NEEDS.filter(() => Math.random() < 0.25);
  const mesh = Math.random() < 0.8;
  return {
    clientId: `sim-${randomUUID()}`,
    channel: mesh ? 'ble_mesh' : 'app',
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    peopleCount: 1 + Math.floor(Math.random() * 6),
    needs,
    message: pick(MESSAGES) ?? undefined,
    reporterName: `Test Resident ${i + 1}`,
    reporterPhone: `0900 000 ${String(1000 + i).slice(-4)}`,
    reportedAt: new Date().toISOString(),
    ...(mesh ? { relayNodeId: n.id, relayHops: 1 + Math.floor(Math.random() * 4) } : {}),
  };
}

async function post(body: object) {
  const res = await fetch(`${api}/sos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-device-key': deviceKey },
    body: JSON.stringify(body),
  });
  return { code: res.status, body: (await res.json()) as { id?: string; duplicate?: boolean; message?: unknown } };
}

const count = Number(args.count);
let created = 0;
let dupes = 0;
for (let i = 0; i < count; i++) {
  const req = makeRequest(i);
  const r = await post(req);
  if (r.code !== 201) {
    console.error(`request ${i + 1} failed: HTTP ${r.code}`, r.body.message);
    process.exit(1);
  }
  created++;
  console.log(
    `SOS ${String(i + 1).padStart(2)}  ${req.channel.padEnd(8)} ${String(req.peopleCount)} people  ${(req.needs.join(',') || '-').padEnd(20)} ${r.body.id}`,
  );
  // A mesh message often reaches the gateway by more than one route.
  if (req.channel === 'ble_mesh' && Math.random() < 0.35) {
    const again = await post({ ...req, relayHops: (req.relayHops ?? 1) + 1 });
    if (again.body.duplicate) dupes++;
    else console.error('  re-delivery was NOT deduplicated');
  }
  if (i < count - 1) await new Promise((r) => setTimeout(r, Number(args.interval) * 1000));
}
console.log(`done: ${created} created, ${dupes} mesh re-deliveries deduplicated`);
