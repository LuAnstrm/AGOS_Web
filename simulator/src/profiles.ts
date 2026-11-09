// Scenario profiles: each returns the TRUE water depth (cm) at tick t.
// Sensor noise, debris outliers and dropouts are layered on in node.ts so
// the Kalman filter downstream has realistic error to correct.

export type ProfileName = 'normal' | 'rising' | 'flash_flood' | 'dropout';

export const PROFILES: readonly ProfileName[] = [
  'normal',
  'rising',
  'flash_flood',
  'dropout',
];

/** Small slow oscillation so "normal" is never perfectly flat. */
function swell(t: number, amplitude = 3, periodTicks = 180): number {
  return amplitude * Math.sin((2 * Math.PI * t) / periodTicks);
}

/**
 * @param t       tick index (one tick = one 60 s uplink)
 * @param base    dry-weather depth for this node (cm)
 */
export function trueDepth(profile: ProfileName, t: number, base: number): number {
  switch (profile) {
    case 'normal':
    case 'dropout':
      return base + swell(t);

    case 'rising': {
      // Sustained rainfall: ~1.2 cm/min rise after a 10-tick lead-in,
      // flattening as it approaches ~170 cm above baseline.
      const k = Math.max(0, t - 10);
      return base + 170 * (1 - Math.exp(-k / 140)) + swell(t, 2);
    }

    case 'flash_flood': {
      // Quiet for 15 ticks, ~200 cm surge over ~8 ticks, short plateau,
      // then a slower exponential recession.
      const onset = 15;
      const riseTicks = 8;
      const plateau = 12;
      const peak = 200;
      if (t < onset) return base + swell(t, 1.5);
      const k = t - onset;
      if (k < riseTicks) {
        const x = k / riseTicks;
        return base + peak * x * x * (3 - 2 * x); // smoothstep surge
      }
      if (k < riseTicks + plateau) return base + peak + swell(t, 4, 7);
      return base + peak * Math.exp(-(k - riseTicks - plateau) / 40);
    }
  }
}
