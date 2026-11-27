# D1.5 — Product Decision Resolution & Database Migration Acceptance

## Scope

Review-only phase. No migration was applied. No remote SQL was executed. No remote
writes, commits, pushes, or deployments occurred.

Reviewed locally:
- `docs/product-discovery/D1-discovery-foundation/` (`01`–`09`, README)
- `supabase/migrations/20261112000001_d1_admin_foundation.sql` (144 lines)
- `supabase/migrations/20261112000002_d1_teams_discovery.sql` (347 lines)
- `src/features/teams/roster/`, `src/lib/game-catalog/`, `src/server/admin/`,
  `src/features/teams/domain/`, `src/features/teams/schemas/team.ts`,
  `src/features/teams/services/search.ts`, and related tests
- G1 migrations `20261110000001`–`20261111000009` and frozen decision records
  `docs/architecture/g1-identity-player-profile/10-open-decisions.md`,
  `11-decision-freeze.md`

Sibling project `whitelabel-lms` (`iwgefthgciddukqabkun`) was not accessed.
G1 behavior and its frozen 12-column projection were not modified.

## Verdict

**FAIL — both D1 migrations are NOT ACCEPTED for application.**

- `20261112000001_d1_admin_foundation`: **NOT ACCEPTED** — 1 High, 3 Medium, 3 Low findings.
- `20261112000002_d1_teams_discovery`: **NOT ACCEPTED** — 2 Critical, 2 High, 5 Medium, 4 Low findings.

The stop condition applies: a Critical or High defect blocks remote application.
The smallest safe corrections are documented in `06-findings-and-required-fixes.md`
and have **not** been applied to the SQL files, because several depend on
unresolved product decisions (owner transfer scope, recruitment lifecycle,
report retention). No SQL file was edited in D1.5.

## D1 decisions

12/12 D1 items are **AWAITING OWNER APPROVAL**. 0/12 are approved.
Details in `01-decision-resolution.md`; approval ledger in `07-owner-approval-record.md`.
No approval is inferred from the existence of an implementation.

## Findings summary

| Rank | Count | IDs |
|---|---|---|
| Critical | 2 | F-T01 (teams UPDATE ownership takeover), F-T02 (application self-accept forgery) |
| High | 3 | F-A01 (suspended super-admin), F-T03 (suspended roster writes), F-T04 (arbitrary member fabrication + missing active gate) |
| Medium | 8 | F-A02, F-A03, F-A04, F-T05, F-T06, F-T07, F-T08, F-T09 |
| Low | 7 | F-A05, F-A06, F-A07, F-T10, F-T11, F-T12, F-T13 |

Full matrix with file:line references in `06-findings-and-required-fixes.md`.
RLS/grants matrix in `04-rls-and-grants-matrix.md`.

## G1 regression

No G1 regression introduced by the D1 SQL text. Evidence in `05-g1-regression-review.md`:
no `ALTER`/`DROP`/`REVOKE` on any G1 table, function, policy, or grant; only reuse
of the existing `public.handle_updated_at()` trigger helper; no storage-policy,
projection, grant, or identity-bootstrap change.

Executable RLS/replay tests against a disposable database were **not** run in D1.5
(no Docker, no second project, no `db reset`, per constraints). They remain
required before any future apply, alongside the fixes in `06`.

## What is required before any apply phase

1. Owner decisions on all 12 D1 items (`01`, `07`).
2. Local SQL corrections for F-T01, F-T02, F-T03/F-T04, F-A01, F-T06 at minimum (`06`).
3. Fresh static re-review of the corrected SQL text.
4. Disposable-replay RLS test gates green (cross-user, captain, suspended, anon,
   duplicate-apply race, LIKE-enumeration, audit append-only, cron lifecycle).
5. Explicit, separate authorization for the apply step with pre/post table-list evidence.
   This D1.5 review is not that authorization.

## Documents in this folder

1. `01-decision-resolution.md` — D1-D1…D1-D12 status.
2. `02-admin-migration-security-review.md` — migration `...000001` audit.
3. `03-teams-migration-security-review.md` — migration `...000002` audit.
4. `04-rls-and-grants-matrix.md` — full RLS/grants matrix.
5. `05-g1-regression-review.md` — G1 non-regression evidence.
6. `06-findings-and-required-fixes.md` — ranked findings + exact corrections.
7. `07-owner-approval-record.md` — approved vs recommended vs awaiting.
