// forge-sim: probability toolkit for game developers.
// Monte Carlo + exact-math simulation of forge/crafting systems with
// escalating fracture risk, and gacha pulls with a hard pity.
// Zero dependencies. Seeded RNG everywhere, so results are reproducible.

/**
 * mulberry32: small fast seeded PRNG.
 * @param {number} seed any 32-bit integer
 * @returns {function} function returning floats in [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Summarize a list of numbers.
 * p90 uses the nearest-rank method.
 * @param {number[]} values
 * @returns {{mean: number, median: number, p90: number, max: number}}
 */
export function summarize(values) {
  if (values.length === 0) return { mean: 0, median: 0, p90: 0, max: 0 };
  const sorted = values.slice().sort((x, y) => x - y);
  const n = sorted.length;
  let sum = 0;
  for (const v of sorted) sum += v;
  const mid = Math.floor(n / 2);
  const median = n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const p90 = sorted[Math.max(0, Math.ceil(0.9 * n) - 1)];
  return { mean: sum / n, median, p90, max: sorted[n - 1] };
}

// ---------------------------------------------------------------------------
// Forge / crafting simulation
//
// Risk model (hammers are numbered 1, 2, 3, ...):
//   - If config.firstHammerSafe is true (the default), hammer 1 has risk 0.
//   - Otherwise, and for every hammer n >= 2, the fracture risk is checked
//     BEFORE the hammer lands and equals
//         risk(n) = min(0.95, baseRisk * riskGrowth^(n-1))
//     So with firstHammerSafe, hammer 2 already uses baseRisk * riskGrowth^1.
//   - A successful hammer multiplies the item value by a uniform random
//     factor in [gainMin, gainMax].
//   - On fracture the run ends and the item value becomes 0.
//   - Stop rules are checked before each hammer: the run stops once the
//     number of successful hammers reaches stopAtHammers, or once the
//     current value reaches stopAtValue. If neither is set, the run goes
//     until fracture (a safety cap of 100000 hammers applies).
//   - At cash-out, taxRate (0..1) of the final value is taken, mimicking
//     ForgeTax-style periodic tax collection.
// ---------------------------------------------------------------------------

function fractureRisk(cfg, n) {
  if (cfg.firstHammerSafe && n === 1) return 0;
  return Math.min(0.95, cfg.baseRisk * Math.pow(cfg.riskGrowth, n - 1));
}

function buildHistogram(values, max, bucketCount) {
  const width = max > 0 ? max / bucketCount : 1;
  const buckets = [];
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({ lo: i * width, hi: (i + 1) * width, count: 0 });
  }
  for (const v of values) {
    const idx = Math.min(bucketCount - 1, Math.floor(v / width));
    buckets[idx].count++;
  }
  return buckets;
}

/**
 * Monte Carlo simulation of a forge run repeated `runs` times.
 *
 * @param {object} config
 * @param {number} [config.startValue=10] value of the fresh item
 * @param {number} [config.gainMin=1.1] per-hammer value multiplier, low end
 * @param {number} [config.gainMax=1.35] per-hammer value multiplier, high end
 * @param {number} [config.baseRisk=0.02] base fracture risk
 * @param {number} [config.riskGrowth=1.35] per-hammer risk growth factor
 * @param {boolean} [config.firstHammerSafe=true] hammer 1 cannot fracture
 * @param {number} [config.stopAtHammers] stop after K successful hammers
 * @param {number} [config.stopAtValue] stop once value >= V
 * @param {number} [config.taxRate=0] fraction of final value taken as tax
 * @param {number} runs number of Monte Carlo runs
 * @param {number} seed seed for the PRNG (same seed = same results)
 * @returns {{runs: number, bustRate: number, mean: number, median: number,
 *   p90: number, max: number, meanHammers: number, histogram: Array}}
 */
export function simulateForge(config, runs, seed) {
  const c = config || {};
  const cfg = {
    startValue: c.startValue === undefined ? 10 : c.startValue,
    gainMin: c.gainMin === undefined ? 1.1 : c.gainMin,
    gainMax: c.gainMax === undefined ? 1.35 : c.gainMax,
    baseRisk: c.baseRisk === undefined ? 0.02 : c.baseRisk,
    riskGrowth: c.riskGrowth === undefined ? 1.35 : c.riskGrowth,
    firstHammerSafe: c.firstHammerSafe === undefined ? true : c.firstHammerSafe,
    stopAtHammers: c.stopAtHammers,
    stopAtValue: c.stopAtValue,
    taxRate: c.taxRate === undefined ? 0 : c.taxRate,
  };
  const rng = mulberry32(seed === undefined ? 1 : seed);
  const values = [];
  let busts = 0;
  let totalHammers = 0;
  const MAX_HAMMERS = 100000;

  for (let r = 0; r < runs; r++) {
    let value = cfg.startValue;
    let hammers = 0;
    let busted = false;
    while (hammers < MAX_HAMMERS) {
      if (cfg.stopAtHammers !== undefined && hammers >= cfg.stopAtHammers) break;
      if (cfg.stopAtValue !== undefined && value >= cfg.stopAtValue) break;
      const risk = fractureRisk(cfg, hammers + 1);
      if (rng() < risk) {
        busted = true;
        value = 0;
        break;
      }
      value *= cfg.gainMin + rng() * (cfg.gainMax - cfg.gainMin);
      hammers++;
    }
    if (busted) busts++;
    totalHammers += hammers;
    values.push(busted ? 0 : value * (1 - cfg.taxRate));
  }

  const s = summarize(values);
  return {
    runs,
    bustRate: runs > 0 ? busts / runs : 0,
    mean: s.mean,
    median: s.median,
    p90: s.p90,
    max: s.max,
    meanHammers: runs > 0 ? totalHammers / runs : 0,
    histogram: buildHistogram(values, s.max, 10),
  };
}

// ---------------------------------------------------------------------------
// Gacha with hard pity
//
// Model: pulls are numbered 1, 2, 3, ... Each pull before the pity pull
// succeeds independently with probability `rate`. If the item has not been
// obtained by pull hardPity - 1, pull hardPity succeeds with certainty.
// ---------------------------------------------------------------------------

/**
 * Exact distribution of "pulls needed to get the item", by dynamic
 * programming over the survival probability.
 *
 * @param {number} rate per-pull success probability in [0, 1]
 * @param {number} hardPity pull number at which success is guaranteed
 * @returns {{expectedPulls: number, cdf: number[], probAtPity: number}}
 *   cdf has length hardPity + 1; cdf[0] = 0 and cdf[k] is the probability
 *   of having obtained the item within k pulls. probAtPity is the
 *   probability that the item arrives exactly on the pity pull.
 */
export function gachaExact(rate, hardPity) {
  const cdf = [0];
  let survival = 1; // probability of reaching pull k still empty-handed
  let cum = 0;
  let expected = 0;
  let probAtPity = 0;
  for (let k = 1; k <= hardPity; k++) {
    const pSuccess = k === hardPity ? survival : survival * rate;
    cum += pSuccess;
    cdf.push(cum);
    expected += k * pSuccess;
    if (k === hardPity) probAtPity = pSuccess;
    survival *= 1 - rate;
  }
  return { expectedPulls: expected, cdf, probAtPity };
}

/**
 * Monte Carlo cross-check of gachaExact.
 * @param {number} rate per-pull success probability in [0, 1]
 * @param {number} hardPity pull number at which success is guaranteed
 * @param {number} runs number of Monte Carlo runs
 * @param {number} seed seed for the PRNG
 * @returns {{mean: number, median: number, p90: number}}
 */
export function simulateGacha(rate, hardPity, runs, seed) {
  const rng = mulberry32(seed === undefined ? 1 : seed);
  const pulls = [];
  for (let r = 0; r < runs; r++) {
    let got = hardPity;
    for (let k = 1; k < hardPity; k++) {
      if (rng() < rate) {
        got = k;
        break;
      }
    }
    pulls.push(got);
  }
  const s = summarize(pulls);
  return { mean: s.mean, median: s.median, p90: s.p90 };
}
