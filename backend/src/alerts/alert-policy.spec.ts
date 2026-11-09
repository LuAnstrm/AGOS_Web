import { AlertTier as T, RiskClass as R } from '../database/enums';
import {
  decide,
  initialPolicyState,
  PolicyInput,
  PolicyState,
  targetTier,
} from './alert-policy';

const MIN = 60_000;
const at = (
  i: number,
  riskClass: R,
  depthCm: number,
  h1Cm: number | null = depthCm,
): PolicyInput => ({ t: i * MIN, riskClass, depthCm, h1Cm });

function run(inputs: PolicyInput[], start: PolicyState = initialPolicyState()) {
  let s = start;
  const tiers: T[] = [];
  const changes: Array<[T, T]> = [];
  for (const inp of inputs) {
    const d = decide(s, inp);
    if (d.changedFrom) changes.push([d.changedFrom, d.state.tier]);
    s = d.state;
    tiers.push(s.tier);
  }
  return { tiers, changes, state: s };
}

describe('alert policy — target tier', () => {
  it.each([
    [R.LOW, 20, 20, T.SAFE],
    [R.LOW, 20, 40, T.ADVISORY],
    [R.MODERATE, 60, 62, T.WATCH],
    [R.MODERATE, 60, 80, T.WARNING],
    [R.HIGH, 100, 100, T.WARNING],
    [R.HIGH, 100, 130, T.CRITICAL],
  ])('%s at %d cm, h1 %d cm → %s', (rc, depth, h1, expected) => {
    expect(targetTier(at(0, rc, depth, h1), null).tier).toBe(expected);
  });

  it('treats a missing forecast as not rising', () => {
    expect(targetTier(at(0, R.LOW, 20, null), null).tier).toBe(T.SAFE);
  });
});

describe('alert policy — escalation', () => {
  it('High + rising forecast reaches Critical faster than High alone', () => {
    const risingRun = run([at(0, R.HIGH, 100, 140)]);
    expect(risingRun.tiers[0]).toBe(T.CRITICAL);

    const steady = run(
      Array.from({ length: 12 }, (_, i) => at(i, R.HIGH, 100, 100)),
    );
    expect(steady.tiers.slice(0, 10).every((t) => t === T.WARNING)).toBe(true);
    expect(steady.tiers[10]).toBe(T.CRITICAL); // held 10 min
  });

  it('escalates immediately and can skip tiers', () => {
    const { changes } = run([at(0, R.LOW, 10), at(1, R.HIGH, 150, 200)]);
    expect(changes).toEqual([[T.SAFE, T.CRITICAL]]);
  });

  it('resets the High hold timer when the class drops', () => {
    const inputs = [
      ...Array.from({ length: 6 }, (_, i) => at(i, R.HIGH, 95)),
      at(6, R.MODERATE, 85),
      ...Array.from({ length: 6 }, (_, i) => at(7 + i, R.HIGH, 95)),
    ];
    expect(run(inputs).tiers.includes(T.CRITICAL)).toBe(false);
  });
});

describe('alert policy — de-escalation hysteresis', () => {
  it('waits for 5 calmer readings before stepping down', () => {
    const start: PolicyState = { ...initialPolicyState(T.WARNING) };
    const { tiers, changes } = run(
      Array.from({ length: 6 }, (_, i) => at(i, R.LOW, 20)),
      start,
    );
    expect(tiers.slice(0, 4).every((t) => t === T.WARNING)).toBe(true);
    expect(tiers[4]).toBe(T.SAFE);
    expect(changes).toEqual([[T.WARNING, T.SAFE]]);
  });

  it('steps down only to the highest tier seen during the calm run', () => {
    const start = initialPolicyState(T.CRITICAL);
    const { changes } = run(
      [
        at(0, R.LOW, 20),
        at(1, R.MODERATE, 60),
        at(2, R.LOW, 20),
        at(3, R.LOW, 20),
        at(4, R.LOW, 20),
      ],
      start,
    );
    expect(changes).toEqual([[T.CRITICAL, T.WATCH]]);
  });

  it('a value hovering at a threshold does not flap', () => {
    const inputs = Array.from({ length: 40 }, (_, i) =>
      at(i, i % 3 === 0 ? R.MODERATE : R.LOW, 44),
    );
    const { changes } = run(inputs);
    expect(changes).toEqual([[T.SAFE, T.WATCH]]);
  });

  it('a calm run broken by a matching reading starts over', () => {
    const start = initialPolicyState(T.WATCH);
    const inputs = [
      at(0, R.LOW, 20),
      at(1, R.LOW, 20),
      at(2, R.LOW, 20),
      at(3, R.MODERATE, 50),
      at(4, R.LOW, 20),
      at(5, R.LOW, 20),
      at(6, R.LOW, 20),
      at(7, R.LOW, 20),
    ];
    expect(run(inputs, start).changes).toEqual([]);
  });
});
