import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trueDepth } from '../src/profiles.ts';
import { SimulatedNode } from '../src/node.ts';

test('flash_flood surges ~200 cm within 8 ticks of onset', () => {
  const before = trueDepth('flash_flood', 14, 10);
  const peak = trueDepth('flash_flood', 23, 10);
  assert.ok(before < 20);
  assert.ok(peak > 190);
});

test('rising climbs monotonically-ish and stays bounded', () => {
  const a = trueDepth('rising', 20, 25);
  const b = trueDepth('rising', 200, 25);
  assert.ok(b > a + 50);
  assert.ok(b < 25 + 175);
});

test('same seed reproduces the same packets', () => {
  const cfg = { id: 'X', lat: 14.8, lng: 120.8, baselineCm: 10, profile: 'normal' as const };
  const at = new Date('2026-11-09T00:00:00Z');
  const a = new SimulatedNode(cfg, undefined, 42).tick(0, at);
  const b = new SimulatedNode(cfg, undefined, 42).tick(0, at);
  assert.deepEqual(a, b);
});

test('failover sends the same reading on two channels', () => {
  const cfg = { id: 'X', lat: 14.8, lng: 120.8, baselineCm: 10, profile: 'normal' as const };
  const node = new SimulatedNode(cfg, { failoverRate: 1, outlierRate: 0, noiseCm: 1 }, 1);
  const [p, q] = node.tick(0, new Date());
  assert.equal(p.timestamp, q.timestamp);
  assert.equal(p.waterDepthCm, q.waterDepthCm);
  assert.notEqual(p.channel, q.channel);
});

test('dropout profile skips some uplinks', () => {
  const cfg = { id: 'D', lat: 14.8, lng: 120.8, baselineCm: 10, profile: 'dropout' as const };
  const node = new SimulatedNode(cfg, undefined, 7);
  let silent = 0;
  for (let t = 0; t < 200; t++) if (node.tick(t, new Date()).length === 0) silent++;
  assert.ok(silent > 5, `expected gaps, got ${silent}`);
});
