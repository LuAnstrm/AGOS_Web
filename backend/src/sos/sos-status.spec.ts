import {
  allowedNext,
  canTransition,
  haversineM,
  SosStatus as S,
} from './sos-status';

describe('SOS status transitions', () => {
  it.each([
    [S.NEW, S.ACKNOWLEDGED],
    [S.NEW, S.CANCELLED],
    [S.ACKNOWLEDGED, S.DISPATCHED],
    [S.ACKNOWLEDGED, S.RESOLVED],
    [S.DISPATCHED, S.RESOLVED],
    [S.DISPATCHED, S.CANCELLED],
  ])('%s → %s is allowed', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    [S.NEW, S.DISPATCHED], // must be acknowledged first
    [S.NEW, S.RESOLVED],
    [S.DISPATCHED, S.ACKNOWLEDGED], // no going back
    [S.RESOLVED, S.NEW],
    [S.CANCELLED, S.ACKNOWLEDGED],
    [S.NEW, S.NEW],
  ])('%s → %s is rejected', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it('resolved and cancelled are final', () => {
    expect(allowedNext(S.RESOLVED)).toEqual([]);
    expect(allowedNext(S.CANCELLED)).toEqual([]);
  });
});

describe('haversineM', () => {
  it('measures ~1.11 km per 0.01° latitude', () => {
    const d = haversineM(
      { lat: 14.84, lng: 120.81 },
      { lat: 14.85, lng: 120.81 },
    );
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1125);
  });

  it('is zero for the same point', () => {
    expect(
      haversineM({ lat: 14.8, lng: 120.8 }, { lat: 14.8, lng: 120.8 }),
    ).toBe(0);
  });
});
