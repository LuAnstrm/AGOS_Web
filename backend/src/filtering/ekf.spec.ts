import {
  distortion,
  EkfState,
  EkfStep,
  initState,
  Measurement,
  step,
} from './ekf';

const MOUNT = 400;
const MIN = 60_000;

/** Seeded PRNG + Gaussian so tests are deterministic. */
function makeRng(seed: number) {
  let a = seed >>> 0;
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () =>
    Math.sqrt(-2 * Math.log(Math.max(u(), 1e-12))) *
    Math.cos(2 * Math.PI * u());
}

/** What firmware would report for a true depth (forward measurement model). */
function measure(
  h: number,
  i: number,
  noise: number,
  opts: { tilt?: number; temp?: number; vib?: number } = {},
): Measurement {
  const k = distortion(opts.tilt ?? 0, opts.temp ?? 20);
  return {
    t: i * MIN,
    z: MOUNT - (MOUNT - h) * k + noise,
    mountHeightCm: MOUNT,
    tiltDeg: opts.tilt ?? 0,
    temperatureC: opts.temp ?? 20,
    vibrationG: opts.vib ?? 0.02,
  };
}

function run(
  truth: (i: number) => number,
  n: number,
  perturb: (i: number) => Partial<{
    noise: number;
    tilt: number;
    temp: number;
    vib: number;
  }> = () => ({}),
) {
  const g = makeRng(7);
  let s: EkfState | null = null;
  const est: number[] = [];
  const raw: number[] = [];
  const rejected: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const p = perturb(i);
    const m = measure(truth(i), i, (p.noise ?? 0) + g() * 1.5, p);
    raw.push(m.z);
    if (!s) {
      s = initState(m);
      est.push(s.x[0]);
      rejected.push(false);
      continue;
    }
    const r: EkfStep = step(s, m)!;
    s = r.state;
    est.push(s.x[0]);
    rejected.push(r.rejected);
  }
  return { est, raw, rejected };
}

const rmse = (a: number[], b: (i: number) => number, from = 0) => {
  let sum = 0;
  for (let i = from; i < a.length; i++) sum += (a[i] - b(i)) ** 2;
  return Math.sqrt(sum / (a.length - from));
};

describe('Extended Kalman Filter', () => {
  it('reduces ultrasonic noise on a steady level', () => {
    const truth = () => 30;
    const { est, raw } = run(truth, 200);
    expect(rmse(est, truth, 20)).toBeLessThan(rmse(raw, truth, 20) * 0.75);
  });

  it('removes temperature drift (34 °C afternoon)', () => {
    const truth = () => 50;
    const { est, raw } = run(truth, 120, () => ({ temp: 34 }));
    const rawBias = raw.slice(20).reduce((s, v) => s + v, 0) / 100 - 50;
    expect(rawBias).toBeGreaterThan(6); // sensor over-reads by ~8 cm
    expect(Math.abs(est[119] - 50)).toBeLessThan(1.5);
  });

  it('corrects pole tilt', () => {
    const truth = () => 80;
    const { est, raw } = run(truth, 120, () => ({ tilt: 8 }));
    expect(raw[119]).toBeLessThan(77);
    expect(Math.abs(est[119] - 80)).toBeLessThan(1.5);
  });

  it('rejects a single debris spike', () => {
    const truth = () => 40;
    const { est, rejected } = run(truth, 60, (i) =>
      i === 40 ? { noise: 45 } : {},
    );
    expect(rejected[40]).toBe(true);
    expect(Math.abs(est[40] - 40)).toBeLessThan(3);
  });

  it('tracks a flash-flood surge (≈200 cm in 8 min) without long lag', () => {
    const truth = (i: number) => {
      if (i < 30) return 10;
      const k = (i - 30) / 8;
      if (k < 1) return 10 + 200 * k * k * (3 - 2 * k);
      return 210;
    };
    const { est } = run(truth, 70);
    // No large overshoot when the surge stops.
    expect(Math.max(...est)).toBeLessThan(210 + 10);
    // Within 3 ticks of the plateau the estimate has caught up.
    for (let i = 41; i < 70; i++)
      expect(Math.abs(est[i] - truth(i))).toBeLessThan(8);
  });

  it('carries the trend through a dropout gap', () => {
    const truth = (i: number) => 20 + 1.2 * i;
    const g = makeRng(3);
    let s = initState(measure(truth(0), 0, 0));
    for (let i = 1; i < 60; i++)
      s = step(s, measure(truth(i), i, g() * 1.5))!.state;
    // 7-minute silence, then one packet
    const r = step(s, measure(truth(67), 67, 0))!;
    expect(r.rejected).toBe(false);
    expect(Math.abs(r.state.x[0] - truth(67))).toBeLessThan(3);
    expect(r.state.x[1]).toBeGreaterThan(0.9);
  });

  it('ignores late / out-of-order packets', () => {
    const s = initState(measure(10, 5, 0));
    expect(step(s, measure(10, 4, 0))).toBeNull();
    expect(step(s, measure(10, 5, 0))).toBeNull();
  });
});
