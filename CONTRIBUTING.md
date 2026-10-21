# Contributing

Thanks for helping. Ground rules:

1. **Zero dependencies** in `src/`. Dev-only tooling is fine.
2. **Everything stays seeded and reproducible** — no `Math.random()` in
   library code; take a seed and use `mulberry32`.
3. **Exact math beats simulation** where both exist: if you add a Monte
   Carlo path, add or extend the exact counterpart and a test that
   cross-checks them.
4. Run tests before sending a PR:

```bash
npm test
```

Keep functions pure and exported individually so they stay testable.
