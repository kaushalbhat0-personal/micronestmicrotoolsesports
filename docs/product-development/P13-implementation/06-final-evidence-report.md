# 06 — Final evidence report (P13-A, recorded 2026-11-12)

## Approvals recorded

D-01…D-14 recorded in `P12-owner-authorization/owner-approval-record.md`
(10 full approvals, D-10 in principle, D-03/D-05/D-09 deferred, D-06
qualified against blind resets). No names/signatures invented.

## Preservation

Branch `new-platform`, HEAD `01893ae` unchanged; single worktree; all prior
uncommitted work preserved; no commit/push/deploy.

## Supabase state (read-only evidence, no secrets)

- Project `knniommcyyhbyiwljisk` / `micronestmicrotoolsesports`,
  `ap-northeast-1`, PG 17.6.1.171, ACTIVE_HEALTHY, linked.
- Remote migrations: baseline + storage (matching) + 7 dashboard-applied G1
  (name-identical, version-different). Remote schema = G1-complete:
  4 tables, 11 policies, 3 triggers, 7 functions, `bgmi` seed, zero user rows.
- **No reset occurred or was needed.** History discrepancy fully explained
  (version mismatch, content live). Forward-only `repair` + `push` plan in
  doc 05, NOT executed — application awaits stage-3/4 authorization.

## F-02 snapshot solution

`20261113000004_p13_f02_snapshot.sql`: version column, 19-field sha256 (UTC
normalized, `published_at` freeze-protected by design), decision binding
columns + CHECK, DEFINER validator (type/version/hash/active-reviewer/
no-self-review). All 10 adversarial cases defeated at the database;Honest
boundary documented (review quality stays procedural).

## Migrations created (local-only, unapplied)

- `20261113000004_p13_f02_snapshot.sql` (support, no behavior change)
- `20261113000005_p13_activation.sql` (D-11 provisioning, 6 queue policies,
  lifecycle replacement with snapshot enforcement; verification cases
  excluded per D-05)

## Migrations applied: NONE

No repair, no push, no DDL executed remotely. CLI/MCP used read-only only.

## Tests (all green)

- `npm test`: **99 files / 1002 tests pass** (P12: 97/975; +27 P13-A).
- `npm run typecheck`: PASS. `npm run lint`: PASS. `npm run build`: PASS.
- `npm run test:e2e`: **23 pass**. G1–P12 regression: no failures; P3
  contract zero-diff.

## RLS / grants / functions (static verification)

No table grants to API roles in new files; 6 gated policies; DEFINER scope
reviewed (provision + validator); revokes on all new functions; no anon
policies; no DELETE policies; no `organizer_members` policy (F-03 posture
preserved); P12 proposal-gate suite updated to the approved state.

## Write switches: all OFF

`ORGANIZER_WRITES_ENABLED`, `TOURNAMENT_WRITES_ENABLED`,
`MODERATION_WRITES_ENABLED` — all `false`, triple-pinned.

## Remaining blockers

1. Stage-3/4 authorization (replay + application go-ahead with named applier).
2. Replay execution + green matrix (needs the authorized environment step).
3. Verification workflow stays deferred (D-05) — a future phase owns case
   policies, evidence, and expiry.
4. Linkage/media/filter deferred (D-02/D-09/D-10) — no action.

## Verdict: CONDITIONAL PASS

Approved designs implemented as unapplied, test-pinned migrations; live
Supabase state characterized read-only with zero user data and a
forward-only plan. Blocked items: any database write and any switch flip
await the stage-3/4 authorizations. No runtime execution is claimed beyond
the SELECT-only inspection above; no launch readiness is claimed.
