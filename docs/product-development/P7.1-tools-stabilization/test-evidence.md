# Test Evidence (P7.1)

## Gates (branch `new-platform`, all after final code state)

| Gate | Result |
|------|--------|
| `npm test` (Vitest, excludes integration) | **73 files / 768 passed** (incl. registry↔map parity test) |
| `npm run test:e2e` (Playwright, Chromium) | **23 passed** — 21 new tool tests + 2 pre-existing |
| `npm run typecheck` | Clean (`tsc --noEmit`) |
| `npm run lint` | Clean (`eslint .`, incl. jsx-a11y) |
| `npm run build` | Clean (all routes render) |

## What the 768 unit tests confirm

All P5–P7 domain suites pass unmodified (768 vs 767 before: +1 parity
test). No domain file was edited in this phase — verified by the passing
suites, not by inspection alone.

## What the 21 interaction tests prove

End-to-end through a real dev server: valid calculations, unallocated
remainder, duplicate/occupied/shrink rejections, tie resolution and
unresolved ties, contested cutoffs, snapshot round-trips, clipboard
contents, two-step resets, keyboard Enter activation, and 390px viewports
with zero horizontal overflow.

## Regression evidence

- Prize calculation behavior unchanged: distribution suites green; reset
  change is UX-only (same defaults restored, now confirmed).
- Roster domain unchanged: roster + schema suites green.
- Tiebreak domain unchanged: engine + schema suites green.
- Registry/discovery unchanged: catalog, query, components, routes suites
  green; pre-existing `home.spec.ts` e2e still passes.
- G1–P4 untouched: no files outside `src/app/tools`, `e2e/tools`,
  `package.json` scripts, and `docs/` were modified.

## Known non-issues

- Playwright downloads its own Chromium on first run (local test
  execution; not a product dependency).
- Dev-server hydration note for prize row-id counters (pre-existing,
  benign, dev-only; see accessibility-review.md).
