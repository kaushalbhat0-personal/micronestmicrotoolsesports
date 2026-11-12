# P3 Test Evidence

## Static tests (no database — the only kind that can run: no migration exists)

Full suite (`npm test`, integration excluded per repo workflow):

- **51 files passed, 541 tests passed, 0 failed** (459 pre-existing +
  82 new P3: domain 12, schemas 10, services/writer 6, reader 12, query
  18, components 15, audit 9).
- G1/P1/P2 boundary suites all green — no regressions.
- `npm run typecheck` — clean (strict; typedRoutes for both tournament routes).
- `npm run lint` — clean (one unused-import warning found and fixed).
- `npm run build` — clean; route table confirms `/tournaments` +
  `/tournaments/[slug]` (dynamic).

## Runtime tests (PostgreSQL/RLS — NOT run, none can exist yet)

No live-database test exists in P3: there is no migration to execute
against, and phase constraints forbid creating/applying one. The required
runtime matrix (key-sets, published-only predicate, escaping/clamp probes,
status-derivation parity, anon+authenticated callers, RLS execution on
disposable replay) is specified in `04-data-model.md` and must run after
the proposal is accepted and migrated. Static fakes assert contract
behavior only — labelled as such in every test file header.

## Live render evidence (dev server, no migration, anon)

| URL | Expected | Observed |
| --- | --- | --- |
| `/tournaments` | 200, arena hero + filters + unavailable state | 200, "Compete", "Filter tournaments", "Tournament directory unavailable", nav "Tournaments" |
| `/tournaments?game=bgmi&status=upcoming` | 200, same shell, filters preserved | 200 (shell renders; invalid-filter path covered by unit tests) |
| `/tournaments/monsoon-showdown-cup` | Generic error boundary (missing RPC, P1-pattern) | 500 via generic boundary, no detail leak |
| `/tournaments/BAD!` | 404, no DB touch, no existence signal | 404 |

Post-migration, re-record with real rows (all three statuses, null
fee/prize, contact-only registration) at 360px and 1280px viewports.

## Layout evidence (structural, no screenshot tooling in env)

Arena hero band (`bg-arena-950`, accent keyline, condensed uppercase
display type) on directory + detail banner; single-column mobile base;
`sm:`/`lg:` filter grids; `md:grid-cols-2` cards; `max-w-5xl` + `px-4
sm:px-6`; labelled controls; `role="status"/"alert"`; announced skeleton.
Same responsive system as the inspected P1/P2 routes.
