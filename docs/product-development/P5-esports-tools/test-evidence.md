# Test Evidence (P5)

> Static unit suite only (`npm test` excludes `*.integration.test.ts`).
> Tools have no database surface, so there is no PostgreSQL/RLS runtime to
> test — by construction, not by omission.

## Suites added

| Suite | File | What it pins |
|---|---|---|
| Catalogue | `src/features/tools/tests/catalog.test.ts` | Registry integrity (unique slugs, semver, no commerce tokens), slug resolution, category labels, game matching |
| Engine schema | `src/features/tools/prize-pool/tests/schema.test.ts` | Major/percent parsing, currency, duplicates, range, coherence sums, strict keys |
| Engine distribution | `src/features/tools/prize-pool/tests/distribution.test.ts` | Exact 50/30/20, fixed+percent mix, largest-remainder, 1-paise split, unallocated, zero total, hostile-total sweep, 8 defensive rejections, ordinals |
| Formatting | covered in component tests | Currency rendering via `formatToolMoney` (no float) |
| Query | `src/app/tools/_lib/query.test.ts` | Filters, fail-safe, hrefs, metadata, canonical |
| Components | `src/app/tools/_components/components.test.tsx` | Cards (incl. coming-soon fixture), filters, results incl. empty + game match, runner initial a11y/mobile shell |
| Route audit | `src/app/tools/routes.test.ts` | No DB/RPC/Supabase, no fetch, no commerce/tracking, no raw HTML, no social proof, registry-only detail, no server actions |

## Boundary matrix (verified)

Zero / negative / oversized / invalid allocations / decimal rounding /
unsupported currencies (`EUR` rejected) / unsupported slugs (404) /
missing tool states (empty) / malformed input (fail-soft) / mobile layout
(`sm:` classes asserted) / keyboard interaction (native labelled controls).

## Commands (run in order)

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Results (2026-11-12, this phase)

- `npm test` — **67 files / 681 tests, all green.** New: 56 P5 tests
  (catalogue 6, engine schema 11, engine distribution 10, tools query 13,
  tools components 9, tools route audit 7). Zero G1–P4 regressions.
- `npm run typecheck` — clean (after `npx next typegen` for `/tools`,
  `/tools/[slug]`).
- `npm run lint` — clean.
- `npm run build` — success; `/tools` and `/tools/[slug]` in the route table.
- Live smoke (`next start`):
  - `GET /tools` → 200, "Esports tools" title, prize-pool-splitter card.
  - `GET /tools/prize-pool-splitter` → 200, landing + runner
    ("Total prize pool", "Calculate breakdown" present; results render only
    after client-side calculation, by design).
  - `GET /tools/no-such-tool` → 404 (invalid/unknown slugs stay 404).
- Static vs runtime: everything is static. Tools have no database surface,
  so no PostgreSQL/RLS runtime tests apply — by construction, not omission.
