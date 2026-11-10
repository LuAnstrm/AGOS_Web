import { AlertTier as T } from '../database/enums';
import {
  bearingDeg,
  CentreIn,
  compass,
  distanceToSegmentM,
  HazardSensor,
  recommend,
} from './evac-rules';

// ~0.009° latitude ≈ 1 km at Malolos.
const home = { lat: 14.84, lng: 120.81 };
const north: CentreIn = {
  id: 'N',
  name: 'North',
  lat: 14.849,
  lng: 120.81,
  status: 'open',
};
const east: CentreIn = {
  id: 'E',
  name: 'East',
  lat: 14.84,
  lng: 120.8255,
  status: 'open',
}; // ~1.7 km
const south: CentreIn = {
  id: 'S',
  name: 'South',
  lat: 14.8355,
  lng: 120.81,
  status: 'open',
}; // ~0.5 km

const sensor = (
  id: string,
  lat: number,
  lng: number,
  tier: T,
): HazardSensor => ({ id, lat, lng, tier });

describe('geometry', () => {
  it('bearing and compass', () => {
    expect(compass(bearingDeg(home, north))).toBe('N');
    expect(compass(bearingDeg(home, east))).toBe('E');
    expect(compass(bearingDeg(home, south))).toBe('S');
  });

  it('distance from a point to a path segment', () => {
    // A point 200 m east of the midpoint of a north-south path.
    const mid = {
      lat: 14.8445,
      lng: 120.81 + 200 / (111_320 * Math.cos((14.84 * Math.PI) / 180)),
    };
    expect(distanceToSegmentM(mid, home, north)).toBeGreaterThan(190);
    expect(distanceToSegmentM(mid, home, north)).toBeLessThan(210);
  });
});

describe('recommend', () => {
  it('picks the nearest open centre when nothing is flooded', () => {
    const r = recommend(
      home,
      [north, east, south],
      [sensor('a', 14.9, 120.9, T.SAFE)],
    );
    expect(r.map((x) => x.centre.id)).toEqual(['S', 'N', 'E']);
    expect(r[0].safety).toBe('safe');
    expect(r[0].walkMinutes).toBeGreaterThanOrEqual(8);
    expect(r[0].walkMinutes).toBeLessThanOrEqual(12);
  });

  it('skips closed and full centres', () => {
    const r = recommend(
      home,
      [{ ...south, status: 'full' }, { ...north, status: 'closed' }, east],
      [],
    );
    expect(r.map((x) => x.centre.id)).toEqual(['E']);
  });

  it('a flooded sensor at a centre pushes it to the end as unsafe', () => {
    const r = recommend(
      home,
      [north, south],
      [sensor('flood', 14.8357, 120.81, T.WARNING)],
    );
    expect(r.map((x) => [x.centre.id, x.safety])).toEqual([
      ['N', 'safe'],
      ['S', 'unsafe'],
    ]);
    expect(r[1].near).toEqual(['flood']);
  });

  it('a flooded sensor on the straight path gives a caution', () => {
    const r = recommend(
      home,
      [north],
      [sensor('mid', 14.8445, 120.8105, T.WATCH)],
    );
    expect(r[0].safety).toBe('caution');
    expect(r[0].near).toEqual(['mid']);
  });

  it('sensors below Watch never count as hazards', () => {
    const r = recommend(
      home,
      [south],
      [sensor('adv', 14.8357, 120.81, T.ADVISORY)],
    );
    expect(r[0].safety).toBe('safe');
  });

  it('respects the limit', () => {
    expect(recommend(home, [north, east, south], [], 2)).toHaveLength(2);
  });
});
