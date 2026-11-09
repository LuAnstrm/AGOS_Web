import { trueDepth, type ProfileName } from './profiles.ts';

export type Channel = 'lorawan' | 'lte' | 'ble_mesh';

export interface NodeConfig {
  id: string;
  lat: number;
  lng: number;
  baselineCm: number;
  profile: ProfileName;
  /** Sensor height above the channel bed (cm). */
  mountHeightCm?: number;
  name?: string;
  barangay?: string;
}

export const DEFAULT_MOUNT_CM = 400;

export function speedOfSound(tempC: number): number {
  return 331.3 * Math.sqrt(1 + tempC / 273.15);
}

/** Same shape as the backend's CreateReadingDto. */
export interface Packet {
  nodeId: string;
  timestamp: string;
  waterDepthCm: number;
  temperatureC: number;
  imu: { tiltDeg: number; vibrationG: number };
  gps: { lat: number; lng: number };
  power: { batteryPct: number; solarChargePct: number };
  channel: Channel;
}

export interface SimOptions {
  /** Probability per tick that the primary channel fails and the packet is
   *  ALSO sent on a backup channel (exercises backend dedup). */
  failoverRate: number;
  /** Probability of a debris/echo outlier on the ultrasonic reading. */
  outlierRate: number;
  /** Ultrasonic noise standard deviation (cm). */
  noiseCm: number;
}

export const DEFAULT_OPTIONS: SimOptions = {
  failoverRate: 0.05,
  outlierRate: 0.02,
  noiseCm: 1.5,
};

/** Seedable PRNG (mulberry32) so a scenario run is reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

export class SimulatedNode {
  private battery = 85;
  private dropoutLeft = 0;
  /** Ground truth behind the last packet — written to the truth log, never sent. */
  lastTrueDepthCm = 0;
  private readonly rand: () => number;
  readonly cfg: NodeConfig;
  private readonly opts: SimOptions;

  constructor(cfg: NodeConfig, opts: SimOptions = DEFAULT_OPTIONS, seed = hash(cfg.id)) {
    this.cfg = cfg;
    this.opts = opts;
    this.rand = rng(seed);
  }

  /**
   * Produces the packets this node transmits at tick t: none during a
   * dropout, one normally, two (primary + backup channel, same timestamp)
   * during a forced failover.
   */
  tick(t: number, at: Date): Packet[] {
    const r = this.rand;

    // Power: solar charges 06:00–18:00 local (UTC+8), drains otherwise.
    const hourPH = (at.getUTCHours() + 8) % 24;
    const sunUp = hourPH >= 6 && hourPH < 18;
    const solar = sunUp ? Math.max(0, Math.sin(((hourPH - 6) / 12) * Math.PI) * 100) : 0;
    this.battery = Math.min(100, Math.max(5, this.battery + (sunUp ? 0.05 : -0.03)));

    if (this.cfg.profile === 'dropout') {
      if (this.dropoutLeft > 0) {
        this.dropoutLeft--;
        return [];
      }
      if (r() < 0.08) {
        this.dropoutLeft = 2 + Math.floor(r() * 6); // 2–7 missed uplinks
        return [];
      }
    }

    const depth = trueDepth(this.cfg.profile, t, this.cfg.baselineCm);
    this.lastTrueDepthCm = depth;

    // Faster-moving water → more pole vibration and tilt.
    const turbulence = Math.min(1, depth / 200);
    const tiltDeg = Math.abs(1 + turbulence * 5 + gaussian(r) * 0.3);
    const vibrationG = Math.abs(0.02 + turbulence * 0.3 + gaussian(r) * 0.02);
    // Air temperature at the transducer: ~27 °C at 05:00, ~35 °C at 14:00.
    const temperatureC = 31 + 4 * Math.sin(((hourPH - 8) / 24) * 2 * Math.PI) + gaussian(r) * 0.3;

    // What the firmware reports: it assumes a vertical beam and 20 °C air, so
    // tilt and heat distort the reading (see backend/src/filtering/ekf.ts).
    const H = this.cfg.mountHeightCm ?? DEFAULT_MOUNT_CM;
    const k = speedOfSound(20) / (speedOfSound(temperatureC) * Math.cos((tiltDeg * Math.PI) / 180));
    let measured = H - (H - depth) * k + gaussian(r) * this.opts.noiseCm * (1 + vibrationG * 3);
    if (r() < this.opts.outlierRate) measured += (r() < 0.5 ? -1 : 1) * (20 + r() * 40);
    measured = Math.max(0, measured);

    const packet: Packet = {
      nodeId: this.cfg.id,
      timestamp: at.toISOString(),
      waterDepthCm: round(measured),
      temperatureC: round(temperatureC, 1),
      imu: { tiltDeg: round(tiltDeg), vibrationG: round(vibrationG, 3) },
      gps: {
        lat: round(this.cfg.lat + gaussian(r) * 0.00001, 6),
        lng: round(this.cfg.lng + gaussian(r) * 0.00001, 6),
      },
      power: { batteryPct: round(this.battery, 1), solarChargePct: round(solar, 1) },
      channel: 'lorawan',
    };

    if (r() < this.opts.failoverRate) {
      const backup: Channel = r() < 0.7 ? 'lte' : 'ble_mesh';
      return [packet, { ...packet, channel: backup }];
    }
    return [packet];
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
