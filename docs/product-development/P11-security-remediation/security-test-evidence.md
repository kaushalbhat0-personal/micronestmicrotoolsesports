# P11 security test evidence

> Commands use npm (constraint). Recorded 2026-11-13. No remote database
> operations; no Docker/disposable database; no commits, pushes, or deploys.
> Static SQL review + simulated authorization only — runtime PostgreSQL/RLS
> execution remains an open item (see `runtime-verification-strategy.md`).

## Unit (`npm test` — unit lane, no integration)

- Result: **96 files / 966 tests passed** (P10 baseline: 93 files / 933).
- 3 new P11 suites (33 tests) + 1 shared helper:
  - `src/features/moderation/tests/f01-trust-guard.test.ts` (8): trigger
    shape, INSERT-must-start-unverified, fail-closed property (only authority
    is fail-closed `is_super_admin()`, no role carve-out, no service role),
    hardened convention (`security invoker`, empty search path, full revokes),
    additive-only proof, creation/update forgery rejection,
    `canTouchVerification() = false` for all roles.
  - `src/features/moderation/tests/f02-content-integrity.test.ts` (13):
    per-field freeze clauses for all 20 material columns, published-only
    firing, lifecycle/system-column separation, rationale coverage for every
    field, direct-bypass denial, unpublish/republish authority matrix.
  - `src/features/moderation/tests/f03-bootstrap-queue.test.ts` (15):
    no policy/grant in any P11 migration, P9 closed posture preserved, no
    claim/provision code, recommendation constants + disabled gate, no
    caller-supplied owner identity, queue coverage/shape, default-deny RLS,
    projection separation, reporter/reviewer identity protections,
    open-review uniqueness, append-only + no-cascade audit integrity,
    evidence-storage exclusion, cross-organizer move rejection, forged
    reviewer-metadata rejection.
  - `src/features/moderation/tests/sql.ts`: comment-stripping helper so
    negative assertions test executable SQL, not header prose.
- Two P11 authoring fixes during the phase (both test-side, no production
  change): negative regexes initially matched migration header comments
  (`search_path` tripped `search_`, `is_super_admin` tripped `admin`) and
  update-parser imports pointed at the schema module instead of the writer —
  corrected to precise semantic assertions.

## Typecheck / lint / build

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run build`: PASS — route surface unchanged (no new routes in P11, no
  product features).

## E2E (`npm run test:e2e`, Playwright)

- Result: **23 passed** (same count as P8–P10). No P11 failures.

## Regression (G1–P10)

- Full unit suite green: G1 identity, P1/P2 teams, P3 tournaments, P4 news,
  P5/P6/P7 tools, P7.1 e2e, P8 org/brand discovery, P9 organizers, P10
  moderation — no failures introduced.
- P3 `TOURNAMENT_DIRECTORY_COLUMNS` and public-card contract untouched
  (zero diff); P3 suites pass; no reader function recreated.
- All three kill-switch pins intact (OFF); G1–P9 migrations untouched;
  three additive P11 migration files only.

## What this evidence does NOT prove (explicit)

Migration bodies reviewed, never executed. Trigger firing under real JWTs,
RLS evaluation, grant effectiveness through PostgREST, queue inertness per
role, partial-index concurrency, and replay atomicity are unverified and
listed in `runtime-verification-strategy.md`. No launch-readiness is claimed
on static evidence.
