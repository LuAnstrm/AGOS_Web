import { AlertTier, RiskClass } from '../database/enums';

/**
 * Five-tier alert policy: maps the Random Forest class plus the LSTM 1-hour
 * forecast to Safe / Advisory / Watch / Warning / Critical.
 *
 *                     1-h forecast steady       1-h forecast rising (≥ risingCm)
 *   Low               Safe                      Advisory
 *   Moderate          Watch                     Warning
 *   High              Warning → Critical        Critical
 *                     after highHoldMin
 *
 * "High + rising escalates faster than High alone" (architecture spec): High
 * with a rising forecast goes straight to Critical; High alone needs to hold
 * for highHoldMin first.
 *
 * Escalation is immediate. De-escalation needs `deescalateAfter` consecutive
 * calmer readings, then drops to the highest tier seen during that run, so a
 * node hovering at a threshold does not flap and spam notifications.
 *
 * Pure — no I/O — so the rules can be unit-tested and tuned in isolation.
 */

export const TIERS: readonly AlertTier[] = [
  AlertTier.SAFE,
  AlertTier.ADVISORY,
  AlertTier.WATCH,
  AlertTier.WARNING,
  AlertTier.CRITICAL,
];

export const rank = (t: AlertTier): number => TIERS.indexOf(t);

export interface PolicyParams {
  /** h1 forecast minus current depth (cm) that counts as "rising". */
  risingCm: number;
  /** Minutes a node must stay High before High alone becomes Critical. */
  highHoldMin: number;
  /** Consecutive calmer readings needed before lowering the tier. */
  deescalateAfter: number;
}

export const DEFAULT_POLICY: PolicyParams = {
  risingCm: 15,
  highHoldMin: 10,
  deescalateAfter: 5,
};

export interface PolicyInput {
  /** Reading time (ms since epoch). */
  t: number;
  riskClass: RiskClass;
  depthCm: number;
  /** LSTM 1-hour forecast; null if the forecaster was unavailable. */
  h1Cm: number | null;
}

export interface PolicyState {
  tier: AlertTier;
  /** When the current unbroken run of High classifications began. */
  highSince: number | null;
  /** Calmer readings seen in a row, and the highest tier among them. */
  calmCount: number;
  calmMax: AlertTier | null;
}

export const initialPolicyState = (
  tier: AlertTier = AlertTier.SAFE,
): PolicyState => ({ tier, highSince: null, calmCount: 0, calmMax: null });

export interface PolicyDecision {
  state: PolicyState;
  /** Tier this reading alone points to, before hysteresis. */
  target: AlertTier;
  /** Set when the published tier changed. */
  changedFrom: AlertTier | null;
  rising: boolean;
}

export function targetTier(
  input: PolicyInput,
  highSince: number | null,
  p: PolicyParams = DEFAULT_POLICY,
): { tier: AlertTier; rising: boolean } {
  const rising = input.h1Cm != null && input.h1Cm - input.depthCm >= p.risingCm;
  switch (input.riskClass) {
    case RiskClass.LOW:
      return { tier: rising ? AlertTier.ADVISORY : AlertTier.SAFE, rising };
    case RiskClass.MODERATE:
      return { tier: rising ? AlertTier.WARNING : AlertTier.WATCH, rising };
    case RiskClass.HIGH: {
      const heldMin = highSince == null ? 0 : (input.t - highSince) / 60_000;
      const critical = rising || heldMin >= p.highHoldMin;
      return {
        tier: critical ? AlertTier.CRITICAL : AlertTier.WARNING,
        rising,
      };
    }
  }
}

export function decide(
  s: PolicyState,
  input: PolicyInput,
  p: PolicyParams = DEFAULT_POLICY,
): PolicyDecision {
  const highSince =
    input.riskClass === RiskClass.HIGH ? (s.highSince ?? input.t) : null;
  const { tier: target, rising } = targetTier(input, highSince, p);

  if (rank(target) > rank(s.tier)) {
    return {
      state: { tier: target, highSince, calmCount: 0, calmMax: null },
      target,
      changedFrom: s.tier,
      rising,
    };
  }

  if (rank(target) < rank(s.tier)) {
    const calmCount = s.calmCount + 1;
    const calmMax =
      s.calmMax && rank(s.calmMax) > rank(target) ? s.calmMax : target;
    if (calmCount >= p.deescalateAfter) {
      return {
        state: { tier: calmMax, highSince, calmCount: 0, calmMax: null },
        target,
        changedFrom: s.tier,
        rising,
      };
    }
    return {
      state: { tier: s.tier, highSince, calmCount, calmMax },
      target,
      changedFrom: null,
      rising,
    };
  }

  return {
    state: { tier: s.tier, highSince, calmCount: 0, calmMax: null },
    target,
    changedFrom: null,
    rising,
  };
}
