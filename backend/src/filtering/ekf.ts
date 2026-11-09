/**
 * Extended Kalman Filter for one ultrasonic water-level node.
 *
 * State   x = [h, r]   h = true water depth (cm), r = rate of change (cm/min)
 * Process            constant-velocity with white-noise acceleration q
 *
 * Measurement model — what the node's firmware reports. The sensor is mounted
 * mountHeightCm above the channel bed and measures a time of flight. Firmware
 * converts it to distance assuming vertical mounting and 20 °C air, then
 * reports depth = mount − distance. The real slant distance is longer when the
 * pole tilts (IMU), and the real speed of sound rises with air temperature:
 *
 *     z = H − (H − h) · k(θ, T),     k = c(20 °C) / (c(T) · cos θ)
 *     c(T) = 331.3 · sqrt(1 + T / 273.15)  m/s
 *
 * z is nonlinear in the auxiliary inputs θ and T; the Jacobian w.r.t. the
 * state is [k, 0], re-linearised at every step.
 *
 * Disturbances handled:
 *   temperature drift  → k(T) in the measurement model
 *   pole tilt / wind   → k(θ), and measurement noise inflated with vibration
 *   debris / echoes    → innovation gate (normalised innovation squared);
 *                        a gated reading is replaced by the prediction, but a
 *                        run of same-sign gated readings is treated as a real
 *                        step change (flash flood) and accepted.
 *   missed uplinks     → process noise scales with the actual time gap.
 */

export interface EkfParams {
  /** Process noise: acceleration spectral density (cm²/min³). */
  q: number;
  /** Base measurement noise variance (cm²). */
  r0: number;
  /** Extra measurement variance per unit vibrationG² (wind / turbulence). */
  vibrationGain: number;
  /** NIS threshold above which a single reading is treated as an outlier. */
  gate: number;
  /** Consecutive same-sign gated readings after which the jump is accepted. */
  stepAcceptAfter: number;
  /** Updates after an accepted jump during which large innovations are
   *  trusted as real change (the surge stopping, reversing) instead of gated. */
  maneuverTicks: number;
  /** Share of the jump's implied rate fed into the rate estimate (0–1). */
  jumpRateGain: number;
}

export const DEFAULT_EKF_PARAMS: EkfParams = {
  q: 0.2,
  r0: 2.25,
  vibrationGain: 40,
  gate: 16, // 4σ
  stepAcceptAfter: 2,
  maneuverTicks: 6,
  jumpRateGain: 0.5,
};

export interface EkfState {
  /** [h, r] */
  x: [number, number];
  /** Row-major 2×2 covariance [P00, P01, P10, P11]. */
  P: [number, number, number, number];
  /** Time of the last update (ms since epoch). */
  t: number;
  /** Signed count of consecutive gated readings (+ above, − below). */
  gateStreak: number;
  /** Updates left in the post-jump manoeuvre window. */
  maneuver?: number;
}

export interface Measurement {
  t: number;
  /** Reported depth (cm) as sent by the node. */
  z: number;
  mountHeightCm: number;
  tiltDeg?: number | null;
  temperatureC?: number | null;
  vibrationG?: number | null;
}

export interface EkfStep {
  state: EkfState;
  /** True if the reading was gated out as an outlier. */
  rejected: boolean;
  /** Depth after tilt/temperature correction, before smoothing. */
  correctedCm: number;
}

const C20 = speedOfSound(20);

export function speedOfSound(tempC: number): number {
  return 331.3 * Math.sqrt(1 + tempC / 273.15);
}

/** k(θ, T): ratio of firmware-assumed distance to true vertical distance. */
export function distortion(
  tiltDeg?: number | null,
  tempC?: number | null,
): number {
  const cosT = Math.cos(((tiltDeg ?? 0) * Math.PI) / 180);
  return C20 / (speedOfSound(tempC ?? 20) * cosT);
}

/** Inverts the measurement model: true depth implied by one raw reading. */
export function correctDepth(m: Measurement): number {
  const k = distortion(m.tiltDeg, m.temperatureC);
  return m.mountHeightCm - (m.mountHeightCm - m.z) / k;
}

export function initState(
  m: Measurement,
  p: EkfParams = DEFAULT_EKF_PARAMS,
): EkfState {
  const k = distortion(m.tiltDeg, m.temperatureC);
  return {
    x: [Math.max(0, correctDepth(m)), 0],
    P: [measurementVar(m, p) / (k * k), 0, 0, 1],
    t: m.t,
    gateStreak: 0,
  };
}

function measurementVar(m: Measurement, p: EkfParams): number {
  const v = m.vibrationG ?? 0;
  return p.r0 * (1 + p.vibrationGain * v * v);
}

/**
 * One predict + update cycle. Returns null if the measurement is not newer
 * than the state (late / out-of-order packet).
 */
export function step(
  s: EkfState,
  m: Measurement,
  p: EkfParams = DEFAULT_EKF_PARAMS,
): EkfStep | null {
  const dt = (m.t - s.t) / 60_000; // minutes
  if (!(dt > 0)) return null;

  // Predict
  const [h, r] = s.x;
  const [p00, p01, , p11] = s.P;
  const xh = h + r * dt;
  const xr = r;
  const dt2 = dt * dt;
  const dt3 = dt2 * dt;
  let P00 = p00 + 2 * dt * p01 + dt2 * p11 + (p.q * dt3) / 3;
  let P01 = p01 + dt * p11 + (p.q * dt2) / 2;
  let P11 = p11 + p.q * dt;

  // Measurement linearisation at the predicted state
  const H = m.mountHeightCm;
  const k = distortion(m.tiltDeg, m.temperatureC);
  const zPred = H - (H - xh) * k;
  const y = m.z - zPred;
  const R = measurementVar(m, p);
  let S = k * k * P00 + R;
  const nis = (y * y) / S;
  const correctedCm = correctDepth(m);

  let gateStreak = 0;
  let maneuver = Math.max(0, (s.maneuver ?? 0) - 1);
  if (nis > p.gate) {
    const sign = Math.sign(y);
    const prev = s.gateStreak;
    gateStreak = Math.sign(prev) === sign ? prev + sign : sign;
    const inManeuver = (s.maneuver ?? 0) > 0;
    if (!inManeuver && Math.abs(gateStreak) < p.stepAcceptAfter) {
      // Outlier: keep the prediction.
      return {
        state: {
          x: [Math.max(0, xh), xr],
          P: [P00, P01, P01, P11],
          t: m.t,
          gateStreak,
          maneuver,
        },
        rejected: true,
        correctedCm,
      };
    }
    // Real change (sustained jump, or the surge stopping/reversing inside the
    // manoeuvre window). Add covariance along the jump direction — depth
    // offset a and implied rate b, correlated — so the filter snaps to the
    // new level and corrects its rate in the same update. PSD for gain ≤ 1.
    const a = y / k;
    const b = a / Math.max(dt, 1);
    const g = p.jumpRateGain;
    P00 += a * a;
    P01 += g * a * b;
    P11 += g * b * b;
    S = k * k * P00 + R;
    gateStreak = 0;
    maneuver = p.maneuverTicks;
  }

  // Update
  const K0 = (P00 * k) / S;
  const K1 = (P01 * k) / S;
  const nh = xh + K0 * y;
  const nr = xr + K1 * y;
  const nP00 = (1 - K0 * k) * P00;
  const nP01 = (1 - K0 * k) * P01;
  const nP11 = P11 - K1 * k * P01;
  P00 = nP00;
  P01 = nP01;
  P11 = nP11;

  return {
    state: {
      x: [Math.max(0, nh), nr],
      P: [P00, P01, P01, P11],
      t: m.t,
      gateStreak,
      maneuver,
    },
    rejected: false,
    correctedCm,
  };
}
