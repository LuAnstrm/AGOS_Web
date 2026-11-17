// Runs the sensor simulation and SOS simulation together.
// The sensor sim loops forever, cycling through escalating profiles so the
// dashboard continuously exercises Safe → Moderate → High → Critical → Safe.
//
// Usage:
//   node src/run.ts                        # loop with 2 s ticks
//   node src/run.ts --interval 5           # slower ticks
//   node src/run.ts --no-loop              # single pass (old behaviour)
//   node src/run.ts --profile storm        # pin one profile, no looping

import { spawn, type ChildProcess } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { values: args } = parseArgs({
  options: {
    interval:    { type: 'string',  default: '2' },
    ticks:       { type: 'string',  default: '60' },
    profile:     { type: 'string' },
    'sos-count': { type: 'string',  default: '5' },
    'sos-interval': { type: 'string', default: '30' },
    loop:        { type: 'boolean', default: true },
    quiet:       { type: 'boolean', default: false },
  },
  allowPositionals: true,
});

const dir = dirname(fileURLToPath(import.meta.url));

// Profiles cycle in escalating order so every loop goes through the full
// alert spectrum: low baseline → sustained rise → flash surge → storm.
const CYCLE: string[] = ['normal', 'rising', 'flash_flood', 'storm'];

function spawnSensor(profile: string): Promise<void> {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        join(dir, 'index.ts'),
        '--interval', args.interval!,
        '--ticks',    args.ticks!,
        '--profile',  profile,
        ...(args.quiet ? ['--quiet'] : []),
      ],
      { env: process.env },
    );
    child.stdout.on('data', (d: Buffer) => process.stdout.write(`[sensor:${profile}] ${d}`));
    child.stderr.on('data', (d: Buffer) => process.stderr.write(`[sensor:${profile}] ${d}`));
    child.on('exit', () => resolve());
  });
}

function spawnSos(): ChildProcess {
  const child = spawn(
    process.execPath,
    [
      join(dir, 'sos.ts'),
      '--count',    args['sos-count']!,
      '--interval', args['sos-interval']!,
    ],
    { env: process.env },
  );
  child.stdout.on('data', (d: Buffer) => process.stdout.write(`[sos] ${d}`));
  child.stderr.on('data', (d: Buffer) => process.stderr.write(`[sos] ${d}`));
  return child;
}

// SOS fires once per sensor cycle.
async function sosCycle() {
  while (true) {
    await new Promise<void>((resolve) => {
      const child = spawnSos();
      child.on('exit', () => resolve());
    });
    // Gap between SOS bursts: one full sensor run worth of time.
    await new Promise((r) => setTimeout(r, Number(args.ticks) * Number(args.interval) * 1000));
  }
}

async function sensorLoop() {
  if (args.profile) {
    // Pinned profile: loop the same one or run once if --no-loop.
    while (true) {
      await spawnSensor(args.profile);
      if (!args.loop) break;
      console.log('[sensor] restarting…');
    }
    return;
  }
  let i = 0;
  while (true) {
    const profile = CYCLE[i % CYCLE.length];
    await spawnSensor(profile);
    i++;
    if (!args.loop) break;
    console.log(`[sensor] cycle ${i} done → next: ${CYCLE[i % CYCLE.length]}`);
  }
}

sosCycle();     // runs in background, never awaited
await sensorLoop();
