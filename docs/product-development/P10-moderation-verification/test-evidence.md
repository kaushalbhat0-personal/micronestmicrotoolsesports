# P10 test evidence

> Commands use npm (constraint). Recorded 2026-11-12. No remote database
> operations; no Docker/disposable database; no commits, pushes, or deploys.

## Unit (`npm test` — unit lane, no integration)

- Result: **93 files / 933 tests passed** (P9 baseline: 89 files / 900).
- 4 new P10 suites (33 tests):
  - `src/features/moderation/tests/domain.test.ts` (11): report vocabulary
    and bounds, forward-only report transitions, decision→lifecycle mapping,
    rejection-as-return, self-approval guard, verification table shape
    (all-disabled, submitter/moderator routing, re-verification, evidence
    categories).
  - `src/features/moderation/tests/schemas.test.ts` (7): intake bounds,
    protected-key rejection, review/decision reason requirements,
    verification-submit minimalism.
  - `src/features/moderation/tests/security.test.ts` (8): moderation kill
    switch OFF, validated-then-blocked intake/review/decision/verification
    ops, disabled queue reader, named-moderator-action throw,
    session-derived identity, `canTouchVerification() = false` for all roles.
  - `src/app/workspace/moderation/routes.test.ts` (7): surface coverage,
    session identity, no service role, no base-table reads, no operational
    controls, kill-switch pin, noindex.
- No pre-existing test was modified; no production behavior changed except
  additive files plus one `npx next typegen` regeneration.

## Typecheck / lint / build

- `npm run typecheck`: PASS (after `npx next typegen` for the four new
  `/workspace/moderation*` typed routes; one fix during P10: sign-in link
  corrected to the existing `/settings/profile` route).
- `npm run lint`: PASS.
- `npm run build`: PASS — output lists `ƒ /workspace/moderation`,
  `ƒ /workspace/moderation/reports`, `ƒ /workspace/moderation/organizers`,
  `ƒ /workspace/moderation/tournaments` alongside the unchanged P9 routes.
- `npm run format:check`: not run as a gate (fails repo-wide on pre-existing
  files since before P9 — pre-existing state, untouched).

## E2E (`npm run test:e2e`, Playwright)

- Result: **23 passed** (same count as P8/P9). No P10 failures; pre-existing
  hydration-mismatch console noise in the prize-pool runner only.

## Security checks (evidence, not claims)

- Route audits (moderation + organizer + P3/P8 suites green) assert: no
  `.from(` base reads on moderation routes, no `service_role`, no direct
  `@supabase/supabase-js` import in routes, no caller identity, no buttons /
  forms / handlers / writer calls, kill switches pinned OFF.
- Reader/writer tests assert strict key-sets, https fail-closed, frozen
  `verified: false`, derived-count integrity, generic errors,
  404-equivalence, and validated-then-blocked writes.
- Migration review is static (`migration-review.md` + `runtime-verification.md`):
  RLS, grants, triggers, and RPC shapes reviewed, never executed. Runtime
  PostgreSQL/RLS verification remains an explicit open item.

## Regression (G1–P9)

- Full unit suite green: G1 identity, P1/P2 teams, P3 tournaments, P4 news,
  P5/P6/P7 tools, P7.1 e2e, P8 org/brand discovery, P9 organizers — no
  failures introduced.
- P3 `TOURNAMENT_DIRECTORY_COLUMNS` unchanged; tournament reader, detail,
  filters, pagination, and unavailable/404 behavior intact.
- P9 `ORGANIZER_WRITES_ENABLED` / `TOURNAMENT_WRITES_ENABLED` pins intact;
  new `MODERATION_WRITES_ENABLED` pin added.
- G1–P9 migrations untouched; no P10 migration file added (queue/verification
  tables are a documented proposal, not DDL).
