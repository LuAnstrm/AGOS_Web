// AGOS simulation layer: posts synthetic sensor packets to POST /readings.
//
//   node src/index.ts                       # real-time: one uplink / 60 s
//   node src/index.ts --interval 2          # accelerated: one tick / 2 s
//   node src/index.ts --ticks 1             # single round, then exit
//   node src/index.ts --profile flash_flood # force every node to one profile
//
// Env: AGOS_API (default http://localhost:3000), AGOS_DEVICE_KEY (gateway key)

import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { PROFILES, type ProfileName } from './profiles.ts';
import {
  DEFAULT_MOUNT_CM,
  DEFAULT_OPTIONS,
  SimulatedNode,
  type NodeConfig,
  type Packet,
} from './node.ts';

const UPLINK_SECONDS = 60;

const { values: args } = parseArgs({
  options: {
    interval: { type: 'string', default: String(UPLINK_SECONDS) },
    ticks: { type: 'string', default: '0' },
    profile: { type: 'string' },
    config: { type: 'string', default: new URL('../nodes.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1') },
    failover: { type: 'string', default: String(DEFAULT_OPTIONS.failoverRate) },
    quiet: { type: 'boolean', default: false },
    /** Write ground-truth depth per packet to this CSV (for EKF evaluation). */
    truth: { type: 'string' },
  },
});

const api = (process.env.AGOS_API ?? 'http://localhost:3000').replace(/\/$/, '');
// Gateways authenticate with the device key (backend DEVICE_API_KEY).
const deviceKey = process.env.AGOS_DEVICE_KEY ?? 'agos-dev-device-key';
const HEADERS = { 'content-type': 'application/json', 'x-device-key': deviceKey };
const intervalMs = Number(args.interval) * 1000;
const maxTicks = Number(args.ticks); // 0 = run forever

if (args.profile && !PROFILES.includes(args.profile as ProfileName)) {
  console.error(`Unknown profile "${args.profile}". Use one of: ${PROFILES.join(', ')}`);
  process.exit(1);
}

const { nodes: configs } = JSON.parse(readFileSync(args.config!, 'utf8')) as { nodes: NodeConfig[] };
const nodes = configs.map(
  (c) =>
    new SimulatedNode(
      { ...c, profile: (args.profile as ProfileName | undefined) ?? c.profile },
      { ...DEFAULT_OPTIONS, failoverRate: Number(args.failover) },
    ),
);

async function send(p: Packet): Promise<string> {
  try {
    const res = await fetch(`${api}/readings`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(p),
    });
    if (!res.ok) return `HTTP ${res.status} ${await res.text()}`;
    const body = (await res.json()) as { status: string };
    return body.status;
  } catch (e) {
    return `error: ${(e as Error).message}`;
  }
}

// Simulated clock: tick timestamps advance by 60 s regardless of the
// wall-clock interval, so accelerated runs still look like real uplinks.
// Use a large random offset (0–60 min into the future) so back-to-back
// runs never reuse the same timestamps even after thousands of cycles.
const start = new Date();
start.setUTCSeconds(0, 0);
start.setTime(start.getTime() + Math.floor(Math.random() * 3600) * 1000);

console.log(
  `AGOS simulator → ${api}/readings | ${nodes.length} nodes | tick every ${args.interval}s` +
    (maxTicks ? ` | ${maxTicks} ticks` : ''),
);

// Register nodes (name, location, mount height) so the backend's filter can
// apply the right geometry. Idempotent.
for (const c of configs) {
  const res = await fetch(`${api}/nodes/${encodeURIComponent(c.id)}`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({
      name: c.name,
      barangay: c.barangay,
      lat: c.lat,
      lng: c.lng,
      mountHeightCm: c.mountHeightCm ?? DEFAULT_MOUNT_CM,
      source: 'simulated',
    }),
  }).catch((e: Error) => e);
  if (res instanceof Error || !res.ok) {
    console.error(`could not register ${c.id}: ${res instanceof Error ? res.message : res.status}`);
    process.exit(1);
  }
}

const truthRows: string[] = ['nodeId,timestamp,trueDepthCm,reportedDepthCm'];

let t = 0;
const stats = { accepted: 0, duplicate: 0, failed: 0, silent: 0 };

async function round() {
  const at = new Date(start.getTime() + t * UPLINK_SECONDS * 1000);
  const lines: string[] = [];
  for (const node of nodes) {
    const packets = node.tick(t, at);
    if (packets.length === 0) {
      stats.silent++;
      lines.push(`  ${node.cfg.id.padEnd(18)} (dropout — no uplink)`);
      continue;
    }
    truthRows.push(
      `${node.cfg.id},${packets[0].timestamp},${node.lastTrueDepthCm.toFixed(2)},${packets[0].waterDepthCm}`,
    );
    for (const p of packets) {
      const result = await send(p);
      if (result === 'accepted') stats.accepted++;
      else if (result === 'duplicate') stats.duplicate++;
      else stats.failed++;
      lines.push(
        `  ${p.nodeId.padEnd(18)} ${p.waterDepthCm.toFixed(1).padStart(6)} cm  ${p.channel.padEnd(8)} ${result}`,
      );
    }
  }
  if (!args.quiet) console.log(`[t=${t} ${at.toISOString()}]\n${lines.join('\n')}`);
  t++;
}

// Rounds never overlap: the next one is scheduled only after the previous
// finishes. (A fixed setInterval let a slow round run alongside the next one,
// so both sent the same tick and half were rejected as duplicates.)
let stopped = false;
process.on('SIGINT', () => {
  stopped = true;
  finish();
});
for (;;) {
  const began = Date.now();
  await round();
  if (stopped || (maxTicks && t >= maxTicks)) break;
  await new Promise((r) => setTimeout(r, Math.max(0, intervalMs - (Date.now() - began))));
}
finish();

function finish() {
  if (args.truth) {
    writeFileSync(args.truth, truthRows.join('\n') + '\n');
    console.log(`truth log → ${args.truth}`);
  }
  console.log(
    `done: ${t} ticks | accepted ${stats.accepted} | duplicate ${stats.duplicate} | failed ${stats.failed} | dropouts ${stats.silent}`,
  );
  process.exit(stats.failed > 0 ? 1 : 0);
}
