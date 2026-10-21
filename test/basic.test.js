import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateForge, simulateGacha, gachaExact } from '../src/index.js';

test('forge: same seed gives identical results', () => {
  const cfg = { stopAtHammers: 12 };
  const a = simulateForge(cfg, 2000, 42);
  const b = simulateForge(cfg, 2000, 42);
  assert.deepEqual(a, b);
});

test('forge: different seeds give different results', () => {
  const cfg = { stopAtHammers: 12 };
  const a = simulateForge(cfg, 2000, 42);
  const b = simulateForge(cfg, 2000, 7);
  assert.notDeepEqual(a, b);
});

test('gachaExact: cdf reaches 1 at hard pity, expectation in range', () => {
  const { expectedPulls, cdf } = gachaExact(0.006, 90);
  assert.ok(Math.abs(cdf[90] - 1) < 1e-9);
  assert.equal(cdf[0], 0);
  assert.ok(expectedPulls >= 1 && expectedPulls <= 90);
});

test('gachaExact: rate 1 means exactly one pull', () => {
  const { expectedPulls, probAtPity } = gachaExact(1, 90);
  assert.equal(expectedPulls, 1);
  assert.equal(probAtPity, 0);
});

test('simulateGacha mean matches gachaExact within 5 percent', () => {
  const exact = gachaExact(0.02, 50);
  const sim = simulateGacha(0.02, 50, 20000, 42);
  const rel = Math.abs(sim.mean - exact.expectedPulls) / exact.expectedPulls;
  assert.ok(rel < 0.05, 'sim mean ' + sim.mean + ' vs exact ' + exact.expectedPulls);
});

test('forge: zero risk never busts and stops exactly at stopAtHammers', () => {
  const r = simulateForge({ baseRisk: 0, riskGrowth: 1, stopAtHammers: 10 }, 500, 3);
  assert.equal(r.bustRate, 0);
  assert.equal(r.meanHammers, 10);
  assert.ok(r.mean > 10); // value only grows from startValue 10
});
