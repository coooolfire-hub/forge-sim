# forge-sim

Balance your game's forge and gacha economy **with numbers, before you ship**:
Monte Carlo simulation plus exact math for crafting systems with escalating
fracture risk (ForgeTax-style) and for gacha pulls with a hard pity.
Seeded RNG — same seed, same results, every time. Zero dependencies.

给游戏开发者用的概率工具包：铸造/强化系统的蒙特卡洛模拟 + 精确概率计算，
支持碎裂风险递增、见好就收策略和抽卡硬保底。带种子随机数，结果可复现，零依赖。

![license](https://img.shields.io/badge/license-MIT-green)

## Why

Forge and gacha systems *feel* impossible to tune by gut:

- "Stop after 12 hammers" vs "stop after 16" — which one pays out more,
  and how often do players lose everything?
- A 0.6% banner with 90-pull hard pity — what is the *real* expected cost
  per item, and what share of players hit pity?

Guessing wrong in either direction is expensive: too generous and your
economy inflates, too stingy and players churn. forge-sim answers these
questions in milliseconds, with exact math where exact math exists and
seeded Monte Carlo everywhere else.

## Install

```bash
npm install forge-sim
```

Or clone this repo and import `src/index.js` directly — there are no
dependencies to install.

## Usage

### Forge: which stop-profit strategy wins?

```js
import { simulateForge } from 'forge-sim';

for (const k of [8, 12, 16]) {
  const r = simulateForge({ stopAtHammers: k }, 10000, 42);
  console.log(k, 'bust rate', r.bustRate.toFixed(3), 'mean value', r.mean.toFixed(1));
}
// r also has: median, p90, max, meanHammers, histogram (10 buckets)
```

Value-based stops and tax rounds work too:

```js
const r = simulateForge(
  { stopAtValue: 500, taxRate: 0.2, baseRisk: 0.03, riskGrowth: 1.3 },
  10000,
  42
);
```

### Gacha: exact math first, simulation as a cross-check

```js
import { gachaExact, simulateGacha } from 'forge-sim';

const exact = gachaExact(0.006, 90);       // 0.6% rate, hard pity at 90
console.log(exact.expectedPulls);          // ~69.7 pulls per item
console.log(exact.cdf[50]);                // P(obtained within 50 pulls)
console.log(exact.probAtPity);             // P(the pity pull is needed)

const sim = simulateGacha(0.006, 90, 20000, 42);
console.log(sim.mean);                     // should sit close to expectedPulls
```

## The forge risk model, defined exactly

Hammers are numbered 1, 2, 3, ... For each run:

1. If `firstHammerSafe` is true (the default), **hammer 1 has fracture
   risk 0**. Otherwise, and for every hammer `n >= 2`, the fracture risk
   is checked **before** the hammer lands and equals:
   `risk(n) = min(0.95, baseRisk * riskGrowth^(n-1))`
2. A successful hammer multiplies the item value by a uniform random
   factor in `[gainMin, gainMax]` (defaults 1.10–1.35).
3. On fracture the run ends and the item value becomes 0.
4. Stop rules are checked before each hammer: the run stops once the
   count of successful hammers reaches `stopAtHammers`, or once the
   current value reaches `stopAtValue`. If neither is set, the run goes
   until fracture.
5. At cash-out, `taxRate` of the final value is taken.

The gacha model: each pull before the pity pull succeeds independently
with probability `rate`; if the item has not dropped by pull
`hardPity - 1`, pull `hardPity` succeeds with certainty.

## Demo

There is no web demo — the CLI example is the demo:

```bash
node examples/cli.js
```

It prints a stop-at-8 / 12 / 16 comparison table for the forge, then the
exact vs simulated expected pulls for a 0.6% / 90-pity banner.

## API

- `mulberry32(seed)` — seeded PRNG, returns a function producing
  floats in [0, 1).
- `simulateForge(config, runs, seed)` — Monte Carlo forge simulation.
  Config: `startValue`, `gainMin`, `gainMax`, `baseRisk`, `riskGrowth`,
  `firstHammerSafe`, `stopAtHammers`, `stopAtValue`, `taxRate`.
  Returns `{ runs, bustRate, mean, median, p90, max, meanHammers, histogram }`.
- `gachaExact(rate, hardPity)` — exact distribution of pulls-to-item.
  Returns `{ expectedPulls, cdf, probAtPity }`, where `cdf[k]` is the
  probability of obtaining the item within k pulls (`cdf[0] = 0`,
  `cdf[hardPity] = 1`).
- `simulateGacha(rate, hardPity, runs, seed)` — Monte Carlo cross-check.
  Returns `{ mean, median, p90 }`.
- `summarize(values)` — `{ mean, median, p90, max }` for a number list.

## 中文说明

**forge-sim 解决什么问题：** 铸剑、强化、抽卡这类系统的数值靠感觉调必翻车。
这个库让你在上线前先算清楚：

- 铸造系统：每锤价值涨幅随机、碎裂风险逐锤递增，玩家在第 K 锤收手
  （或价值达到 V 收手）时，爆率是多少、期望收益是多少，税率抽多少合适
- 抽卡系统：给定单抽概率和硬保底，用动态规划算出精确的期望抽数、
  累积概率曲线 (cdf)，再用蒙特卡洛模拟交叉验证

所有随机数都带种子：同一个种子跑多少次结果都一样，方便回归测试和
调参对比。用法看上面的 Usage 一节，跑一遍 `node examples/cli.js`
就能看到完整的策略对比表。

## Roadmap

- [ ] Soft pity (rate ramps up before the hard pity pull)
- [ ] Multi-item banners and off-banner / 50-50 loss mechanics
- [ ] Currency cost model (pulls to dollars, monthly card / welkin effects)
- [ ] Forge: repair items, risk-free streak consumables, relic modifiers
- [ ] Exact forge math via DP to complement the Monte Carlo path

## Related

forge-sim was born from balancing
**Master Swordsmith (铸剑大师)**, a ForgeTax-style WeChat mini-game about
hammering swords under escalating fracture risk and periodic tax rounds:
knowing exactly when a rational player should stop hammering is the whole
game — and the whole balancing problem.

## License

MIT
