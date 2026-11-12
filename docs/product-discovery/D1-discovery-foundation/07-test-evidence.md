# 07 — Test Evidence (GATE D1.7)

**Date:** 2026-11-11 · **Branch:** `new-platform` · **Runner:** `npm test` (vitest, `src/**/*.test.ts`), `typecheck`, `lint`, `build`.

## Results

- `npm test`: **31 files / 308 tests PASS** (0 fail). New D1: `teams/roster/tests/normalize.test.ts` (7), `parser.test.ts` (10), `roster.test.ts` (8), `teams/tests/teams-domain.test.ts` (8), `lib/game-catalog/catalog.test.ts` (4), `server/admin/audit.test.ts` (6) = **43 new**. G1 regression: all existing player-profile/marketing/players tests green.
- `npm run typecheck`: PASS (`tsc --noEmit`).
- `npm run lint`: PASS (`eslint .`).
- `npm run build`: PASS (Next 16.4.6, 8 routes: `/`, `/about`, `/api/health`, `/icon.svg`, `/players`, `/players/[handle]`, `/settings/profile`, `/sitemap.xml`).

## Coverage by gate

- D1.1: unit (normalize/parser/conflicts/slots/output/schemas) + malformed/adversarial + determinism. No DB/auth (pure by construction).
- D1.2: alias/supported/planned/never-throw.
- D1.3: action/target/reason/UUID/forbidden-key/projection.
- D1.4: levels/roles/matching-tiers/hard-filters/schemas/search-parsers.
- D1.5: design-only (SQL reviewed, not applied). No direct RPC tests yet — pending migration acceptance.
- Authorization/cross-user/cross-team/org-boundary/anonymous/projection-privacy/concurrency: specified in `05`/`06`, executable only after migration apply (deferred, see `09`).

## Data safety

Isolated identities only (hardcoded test UUIDs, no live users). No remote writes. Live DB untouched (verified 4 tables / 9 migrations post-run). No user data deleted/overwritten.
