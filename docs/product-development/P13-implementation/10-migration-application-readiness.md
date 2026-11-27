# 10 — Migration application readiness (P13-B, plan only — NOT executed)

No migration was applied, repaired, reset, or pushed in P13-B. This doc is
the exact ordered plan plus rollback/failure handling for a future authorized
window. Constraints preserved: no Docker, no second project, no reset, D-05 /
D-02 / D-09 stay deferred, switches stay OFF.

## 1. Preconditions (all verified this phase)

- Ref `knniommcyyhbyiwljisk`, ACTIVE_HEALTHY, PG 17.6.1.171, linked. Sibling
  `whitelabel-lms` never touched (listed for identity only).
- Remote = G1-complete (§07): 9 versions, 4 tables, 11 policies, 3 triggers,
  7 functions, `bgmi` seed, zero user rows.
- Local order (filename sort = apply order): foundation 01–02 → G1 03–09 →
  D1 01–04 → P9 05–06 → P11 01–03 → P13 04–05. No cycles; each file's
  references exist when it runs (`is_super_admin` from D1-01/03, queue tables
  from P11-03, hash/validator from P13-04 before P13-05).
- Branch `new-platform`, HEAD `01893ae`; uncommitted work preserved; no
  commit/push/deploy.
- Write switches OFF (`ORGANIZER/TOURNAMENT/MODERATION_WRITES_ENABLED =
  false`, test-pinned). No migration flips them.

## 2. Dependency review

- P9/P11 dependencies: P13-04 needs `tournaments` + `moderation_decisions`
  (P9-05/06, P11-03) and `platform_admins` + `app_users` (G1+D1-01);
  P13-05 needs `is_super_admin()` (D1) + queue tables (P11-03) + P13-04
  objects. Order 04→05 fixed.
- G1 reconciliation (§07): all 7 dashboard versions map 1:1 by name to
  local 03–09 with objects present. Push BEFORE repair replays G1 DDL and
  fails — repair is mandatory first, authorization-gated.
- F-02 snapshot file: additive only (1 column, 2 functions, 2 columns +
  CHECK, 8 revokes); modifies no existing object; no behavior change alone.
- Activation file: one function replacement (`enforce_tournament_lifecycle`,
  P9-body-identical except moderator branches + version bump) + 1 new
  function + 6 policies + grants-to-authenticated-EXECUTE-only. No table
  grants, no P3 reader change, no freeze-weakening, no verification-case
  policy (D-05 deferred → table inert).
- G1-user impact: zero user rows remotely; `bgmi` seed untouched by all
  downstream files; G1 RLS/RPC surface unchanged by P13 files (additive).

## 3. Exact ordered application plan (AUTHORIZATION REQUIRED — do not run yet)

Step 0 — authorizations (stage-3/4 per P12): owner sign-off on this plan +
named applier + target ref `knniommcyyhbyiwljisk` + rollback readiness. Abort
on any prompt suggesting reset/destructive SQL or any ref mismatch.

Step 1 — history alignment (forward-only, NO data change). Marks the 7 local
G1 versions applied WITHOUT running them. MUTATES the migration ledger
(do not run in this phase):

```powershell
npx supabase migration repair --status applied 20261110000003 20261110000004 20261110000005 20261110000006 20261110000007 20261111000008 20261111000009
npx supabase migration list
# REQUIRED: all 7 rows flip to local↔remote matched. Otherwise STOP.
```

Step 2 — push genuinely-new files only. MUTATES the primary schema
(do not run in this phase):

```powershell
npx supabase db push
# Expected set, in order: 20261112000001..04 (D1), 20261112000005..06 (P9),
# 20261113000001..03 (P11), 20261113000004..05 (P13). No other version may appear.
npx supabase migration list
# REQUIRED: every local version shows a remote match.
```

Step 3 — post-push read-only verification: re-run §07 inventory (new tables
`platform_admins/organizers/organizer_members/tournaments/moderation_reports/
verification_cases/moderation_decisions`, new functions `is_super_admin`,
guards, `provision_organizer`, hash, validator, masked RPCs; new policies/
triggers) + `npm test` (P3 projection suites must stay green) + advisors.

Step 4 — controlled runtime battery (§09) with test identities + cleanup,
switches still OFF. Separate phase; needs its own evidence log.

Step 5 — bootstrap + switch sequence per P12 stages 6–10 (NOT P13-B).

## 4. Commands that would mutate the primary (identified, NOT executed)

1. `supabase migration repair --status applied …` — rewrites ledger (Step 1).
2. `supabase db push` — applies DDL for 11 files (Step 2).
3. Any `supabase db reset`, `db push --dry-run` variant that writes, MCP
   `apply_migration`, MCP `execute_sql` DDL/DML, branch create/merge —
   all prohibited and none executed.

## 5. Transaction boundaries / rollback / failure recovery

- Each migration file runs in its own transaction (Supabase default); files
  are ordered so a mid-push failure leaves a prefix applied and is resumable
  after diagnosis (ledger shows exactly where it stopped).
- P13-04 rollback: drop validator + hash functions, drop the 3 columns +
  CHECK (reverse creation order). No data exists pre-application.
- P13-05 rollback: drop §3 policies + `provision_organizer`; re-apply the P9
  file-06 `enforce_tournament_lifecycle` body verbatim (restore source pinned
  in the file header). Snapshot objects roll back per P13-04 notes.
- Failure rules: ledger mismatch after Step 1 → stop, re-preflight, report.
  Unexpected version in Step 2 → stop. Any reset/destructive prompt → stop
  and report. Any drift vs `migration list` → stop.
- Activation without application writes: YES — safe by design. The file adds
  authority-gated paths only; app writers stay OFF; RLS default-deny covers
  every new table except via the 6 approved policies; no anon/DELETE policy
  is added.
