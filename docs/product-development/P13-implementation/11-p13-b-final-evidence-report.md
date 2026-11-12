# 11 — P13-B final evidence report (2026-11-12, read-only)

P13-A (CONDITIONAL PASS) evidence re-verified and extended. No reset, no
repair, no push, no remote DDL, no persistent write of any kind occurred in
P13-B. All three write switches remain OFF. D-02/D-05/D-09 remain deferred.

## 1. Baseline verification

- Ref exactly `knniommcyyhbyiwljisk` (`micronestmicrotoolsesports`,
  ACTIVE_HEALTHY, PG 17.6.1.171, ap-northeast-1, linked). Proven via CLI
  `projects list` + MCP `get_project` + `list_projects`.
- No sibling access: `whitelabel-lms` (`iwgefthgciddukqabkun`) appeared only
  in the project listing; every data call targeted `knniomm…`. No branch,
  no second project, no Docker (`supabase status` → no engine pipe).
- Remote ledger: 9 versions (01, 02 + 7 G1 dashboard stamps) via CLI +
  MCP — identical sets. Local: 20 files (01–02 matched; 03–09 + 11…08/09 +
  12…01–04 + 13…01–05 local-only).
- Remote schema (SELECT-only): 4 tables with row counts 0/0/1/0, `bgmi` seed
  intact, 11 policies, 3 `updated_at` triggers, 7 G1 functions — matches
  P13-A inventory exactly. No `platform_admins/organizers/tournaments`/queue
  tables: P9/P11/P13 genuinely unapplied.
- Local order + branch: 20 files sort-clean; branch `new-platform`, HEAD
  `01893ae`; `git status` shows the same uncommitted-work pattern preserved
  (M + ?? additions incl. all P13 files). No commit/push/deploy.
- Switches OFF: `ORGANIZER/TOURNAMENT/MODERATION_WRITES_ENABLED = false`
  re-grepped in writers + test pins.

## 2. G1 reconciliation

- Seven dashboard versions map 1:1 by name to local 03–09 (§07 table):
  identity anchor, grant tightening, player profile, game catalogue, public
  projection, owner settings/lifecycle, handle-ambiguity fix.
- Object evidence per file: tables/triggers/functions/policies/seed all
  present as specified; advisor EXECUTE WARNs match the approved RPC posture.
- Residuals recorded honestly: grant-surface exactness, index inventory,
  function-body text (one-line 09 qualification) not dumped via SELECT —
  none blocks the recommendation (zero user rows, no extra G1 object).
- Recommendation: forward-only `repair --status applied` for exactly the 7
  local G1 stamps AFTER stage-3/4 authorization, verify flip, then push only
  genuinely-new files. Ledger NOT touched in P13-B (repair would merely
  cosmetic-clean without the authorization + evidence basis — prohibited).

## 3. Runtime capability matrix (§08)

SAFE + used: CLI `migration list`, MCP SELECT inventory, advisors.
UNAVAILABLE: local Docker stack. PROHIBITED (never called): `apply_migration`,
`execute_sql` writes, `repair/push/reset`, branches. BLOCKED without an
authorized write window: real-JWT RLS proof, PostgREST probes, concurrency/
atomicity/fault-injection tests. Transaction-rollback and claim-spoofing
shortcuts explicitly rejected as unsafe theater.

## 4. Is faithful PostgreSQL/RLS runtime testing possible? NO.

Under P13-B constraints (no Docker, no second project, no primary writes),
there is no faithful safe route: the SQL channel runs as the wrong role with
`auth.uid()` NULL, P13 objects/dependencies do not exist remotely yet, and
any sandbox that creates them mutates the primary. Do not claim runtime
verification. Static + simulated coverage stands; live enforcement is the
open gap (§09.E).

## 5. F-02 test coverage and remaining gaps

- Planned exactly (§09.A–E): 15 snapshot + 10 provisioning + 15 moderation/
  RLS + 9 lifecycle cases, each with steps, expected outcome, today's layer
  (static/simulated) and required layer (PostgreSQL/RLS/PostgREST).
- 20-field rule: 19 hash-bound + `published_at` freeze-bound, rationale
  pinned in code + tests; live per-field UPDATE probes await the window.
- Gaps: trigger firing, per-role allow/deny, PostgREST codes, two-session
  concurrency, audit-atomicity fault injection, JWT binding — all require the
  authorized post-push battery.

## 6. Application readiness

Ordered plan (§10): preconditions green → authorized repair(7) → verified
flip → authorized push(11 files: D1 01–04, P9 05–06, P11 01–03, P13 04–05)
→ read-only inventory + suites + advisors → controlled runtime battery →
P12 bootstrap/switch sequence. Every mutating command named and NOT run.
Activation without application writes is safe by design (gated paths only,
no table grants, default-deny preserved).

## 7. Remaining blockers

1. Stage-3/4 authorization (named applier, ref, rollback readiness) for G1
   repair + push — the single gate for everything downstream.
2. Post-push controlled runtime battery (§09) with test identities + cleanup.
3. D-05/D-02/D-09 stay deferred — no verification workflow, linkage, or
   media workarounds in any window.
4. Optional read-only close-out (indexes, table grants, `pg_get_functiondef`)
   before repair — nice-to-have, not blocking.

## 8. No-write confirmation

- Executed: CLI `projects list`, `migration list`, `status` (probe);
  MCP `get_project/list_projects/list_migrations/list_tables/execute_sql`
  (SELECT-only) + `get_advisors`; local `read/grep/glob`, `git status/log`.
- NEVER executed: `db push/reset`, `migration repair`, MCP `apply_migration`,
  any DDL/DML/insert/update/delete, branch/project creation, commit/push/
  deploy, service-role exposure, legacy-runtime imports, historical-migration
  edits. `supabase status` Docker error is an environment observation, not a
  mutation.

## 9. Switch confirmation

`ORGANIZER_WRITES_ENABLED`, `TOURNAMENT_WRITES_ENABLED`,
`MODERATION_WRITES_ENABLED` — all `false`, re-verified in source + test pins.
No migration flips them.

## Verdict: BLOCKED (for runtime verification and controlled application)

Designs remain sound (P13-A CONDITIONAL PASS stands); G1 reconciliation is
proven; the ordered plan is exact. But faithful PostgreSQL/RLS/PostgREST
runtime testing is impossible under current constraints, and the G1 repair +
push that would unblock it lacks stage-3/4 authorization. No application or
launch readiness is claimed. Next action: record the authorization, then
execute §10 Steps 1–4 with §09 as the evidence battery.
