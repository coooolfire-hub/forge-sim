// forge-simulator CLI demo: compare stop-profit strategies for the forge,
// then cross-check exact gacha math against Monte Carlo.
// Run with: node examples/cli.js

import { simulateForge, gachaExact, simulateGacha } from '../src/index.js';

function row(cols, widths) {
  return cols.map((c, i) => String(c).padEnd(widths[i])).join(' ');
}

console.log('=== Forge: stop after K successful hammers (10000 runs, seed 42) ===');
console.log('Config: startValue 10, gain x1.10-1.35 per hammer, baseRisk 0.02, riskGrowth 1.35, first hammer safe');
const widths = [6, 8, 10, 10, 10, 12, 8];
console.log(row(['stopK', 'bust%', 'mean', 'median', 'p90', 'max', 'avgHits'], widths));
for (const k of [8, 12, 16]) {
  const r = simulateForge({ stopAtHammers: k }, 10000, 42);
  console.log(row([
    k,
    (r.bustRate * 100).toFixed(1),
    r.mean.toFixed(2),
    r.median.toFixed(2),
    r.p90.toFixed(2),
    r.max.toFixed(2),
    r.meanHammers.toFixed(2),
  ], widths));
}

console.log('');
console.log('=== Gacha: rate 0.006, hard pity 90 ===');
const exact = gachaExact(0.006, 90);
const sim = simulateGacha(0.006, 90, 20000, 42);
console.log('Exact expected pulls:    ' + exact.expectedPulls.toFixed(2));
console.log('Simulated mean pulls:    ' + sim.mean.toFixed(2) + ' (20000 runs, seed 42)');
console.log('P(need the pity pull):   ' + (exact.probAtPity * 100).toFixed(2) + '%');
console.log('P(obtained within 50):   ' + (exact.cdf[50] * 100).toFixed(2) + '%');
