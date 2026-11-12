# Test Evidence (P6)

## Gates (run 2026-11-12, branch `new-platform`)

| Gate | Result |
|------|--------|
| `npm test` | **70 files / 724 tests passed** (incl. 43 new) |
| `npm run typecheck` | Clean (`tsc --noEmit`, no output) |
| `npm run lint` | Clean (`eslint .`, incl. jsx-a11y) |
| `npm run build` | Clean (13 static pages, `/tools/[slug]` renders) |

New suites: `roster/tests/schema.test.ts` (13), `roster/tests/roster.test.ts`
(21), `app/tools/tools-roster.test.tsx` (9: registry, filtering, runner UI).

## Domain coverage (brief-mapped)

Empty / add / remove / duplicate + normalization / starter assign /
substitute assign / unassign / slot capacity (12-player cap, 0-sub plans) /
incomplete / complete / invalid + oversized input / unsupported + planned
games / deterministic summary — all green.

## UX coverage

Static-render tests: labelled setup/add/action controls, empty state copy,
honest status, card grid without `<table>`, aria-live + progressbar wiring.
Interactive flows (add/edit/assign/remove/reset/copy, keyboard traversal,
viewport behavior) verified by code inspection against P5 runner patterns,
not automated — Playwright has no tool specs and none were added (see
deferred-decisions.md).

## Regression evidence (G1–P5)

- Splitter engine/schema/runner/tests untouched; `catalog.test.ts`,
  `routes.test.ts`, `query.test.ts` pass unmodified.
- One intentional test update: `components.test.tsx` count assertion
  `Showing 1 tool.` → `Showing 2 tools.` (registry growth, not behavior).
- New `catalog.ts` copy re-passes the commerce/tracking token scan.
- Static route audit passes with the new runner sources included.
