# P9 test evidence

> Commands use npm (constraint). Recorded 2026-11-12. No remote database
> operations; no Docker/disposable database; no commits, pushes or deploys.

## Unit (`npm test` — unit lane, no integration)

- Result: **89 files / 900 tests passed** (P8 baseline: 83 files / 841).
- 6 new P9 suites (59 tests):
  - `src/features/organizers/tests/domain.test.ts` (11): type vocabulary,
    column contract, trust presentation, permission matrix, lifecycle table.
  - `src/features/organizers/tests/schemas.test.ts` (13): slug normalization,
    organizer/tournament contracts, protected-key rejection, money/timezone/
    URL validation, directory bounds.
  - `src/features/organizers/tests/reader.test.ts` (10): invalid fail-closed,
    vocabulary pre-RPC, key-set pinning, bad-URL fail-closed, unknown-game
    pass-through, 404/operation errors, explicit linkage.
  - `src/features/organizers/tests/security.test.ts` (10): gate OFF,
    validated-then-blocked writes, session identity, forged-value rejection,
    cross-organizer lock, unauthorized publish/unpublish, moderation guard.
  - `src/app/organizers/routes.test.ts` (9): reader-only audit, kill-switch pin.
  - `src/app/workspace/organizer/routes.test.ts` (6): session identity,
    no service role, disabled boundary, no verification surface, kill-switch pin.
- Initial run: 6 failures, all in new P9 assertions (over-strict label
  matcher, fake-client missing the `ensure_app_user` RPC shape, comment-token
  collisions in static audits). Fixed by correcting the tests and tightening
  the audited surface (P2 parity: `_lib` parsers excluded, write-shaped
  patterns audited). No production-code behavior changed except moving the
  workspace boundary copy out of the `"use server"` module (build rule).

## Typecheck / lint / build

- `npm run typecheck`: PASS (after `npx next typegen` for the new
  `/organizers` + `/workspace/organizer*` typed routes).
- `npm run lint`: PASS.
- `npm run build`: PASS — output lists `ƒ /organizers`,
  `ƒ /organizers/[slug]`, `ƒ /workspace/organizer`,
  `ƒ /workspace/organizer/tournaments`,
  `ƒ /workspace/organizer/tournaments/new`,
  `ƒ /workspace/organizer/tournaments/[id]/edit`.
- Build fix during P9: the workspace `actions.ts` exported a boundary
  constant from a `"use server"` module (async-functions-only rule). The
  copy now lives in `_lib/boundary.ts`, imported by actions and clients.
- `npm run format:check`: fails repo-wide on pre-existing files
  (`ref/legacy-project`, older `src` files) — pre-P9 state, untouched. All
  P9-created/modified files are prettier-clean.

## E2E (`npm run test:e2e`, Playwright)

- Result: **23 passed** (P7.1 suite: home, about, tools roster/tiebreak —
  same count as P8). Pre-existing hydration-mismatch console noise in the
  prize-pool runner only; no P9 failures.
- P9 route posture verified by build + unit/component/route-audit coverage:
  directories render with filters and resolve to the unavailable state until
  the proposed RPCs land (never fake rows); profiles return generic not-found
  for unknown slugs; header/footer expose Discover organizers with labelled
  controls and focus states.

## Security checks (evidence, not claims)

- Route audits (`routes.test.ts` × 2 + P3/P8 suites still green) assert: no
  `.from("` base reads on public routes, no `service_role`, no direct
  `@supabase/supabase-js` import in routes, no caller identity, reader-only
  public paths, no writes, kill switches pinned OFF.
- Reader tests assert strict key-sets, https fail-closed URLs, frozen
  `verified: false`, derived-count integrity, generic errors, 404-equivalence.
- Writer tests assert validated inputs still throw `OrganizerWriteDisabledError`
  before any table touch; moderator transitions throw unconditionally.
- Migration review is static (see `security-and-rls-review.md`): RLS,
  grants, triggers and RPC shapes reviewed, never executed. Runtime
  PostgreSQL/RLS verification is an explicit open item for P10.

## Regression (G1–P8)

- Full unit suite green: G1 identity, P1/P2 teams, P3 tournaments, P4 news,
  P5/P6/P7 tools, P7.1 e2e, P8 org/brand discovery — no failures introduced.
- P3 `TOURNAMENT_DIRECTORY_COLUMNS` unchanged; tournament reader, detail,
  filters, pagination and unavailable/404 behavior intact (P3 suites pass;
  only additive organizer-profile linking).
- G1–P8 migrations untouched; two additive P9 migration files only.
