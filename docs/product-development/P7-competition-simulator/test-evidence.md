# Test Evidence (P7)

## Gates (run 2026-11-12, branch `new-platform`)

| Gate | Result |
|------|--------|
| `npm test` | **73 files / 767 passed** (incl. 47 new) |
| `npm run typecheck` | Clean (`tsc --noEmit`, no output) |
| `npm run lint` | Clean (`eslint .`, incl. jsx-a11y) |
| `npm run build` | Clean (tool routes render) |

New suites: `tiebreak/tests/schema.test.ts` (10), `tiebreak/tests/engine.test.ts`
(24), `app/tools/tools-tiebreak.test.tsx` (13). New total = 47 tests.

## Domain coverage (brief-mapped)

Empty / single team / multi-team / exact totals / negative + zero weights /
priority ordering / equal scores / resolved ties (both directions) /
unresolved ties (no invented winner, entry-order display, 1224 ranks) /
duplicates + normalization / missing-as-zero with flags / invalid weights +
out-of-range scores + bad names + oversized cutoffs / cutoff clean /
cutoff straddled (contested, "Not auto-qualified") / cutoff off / cutoff
above field / repeated-run determinism / frozen-input immutability /
malformed field input.

## UX coverage

Static-render tests: labelled setup/criteria/team/snapshot/action controls,
empty-state copy, simulation-only labelling, card grid without `<table>`.
Interactive flows (cell commits, priority moves, snapshot restore, copy,
keyboard traversal, viewports) are inspection-verified against P5/P6
patterns, not automated — no Playwright tool specs exist (see
deferred-decisions in P6, carried here).

## Regression evidence (G1–P6)

- Splitter + roster engines, schemas, runners, copy untouched; their suites
  pass unmodified.
- Two intentional test updates: registry length 2 → 3
  (`tools-roster.test.tsx`), directory count "2 tools" → "3 tools"
  (`components.test.tsx`, `tools-roster.test.tsx`) — registry growth, not
  behavior change.
- Static route audit, catalog token scans, and 404-equivalence behavior all
  pass with the third tool included.
