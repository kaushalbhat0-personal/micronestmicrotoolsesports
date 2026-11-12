# 11 — P13-B readiness report (2026-11-12, read-only)

Head: `new-platform` @ `376df8f651f3142dcaacb2ddbcbf269b38196040`, single
worktree, all changes preserved. No reset, no repair, no push, no remote DDL,
no persistent write of any kind occurred in P13-B. All three activation switches
remain OFF. D-02/D-03/D-05/D-09 remain deferred. Sibling `whitelabel-lms` never
accessed beyond the project-listing identity check.

P13-A owner authorization (qualified, D-06: inspection + controlled migration
workflow only) and P13-A evidence re-read before any Supabase operation. P14-B4
(Player Directory: frozen G1 12-column projection, `DirectoryReader` sole path,
1,012 unit + 9/9 E2E per task context) added no migration file and changed no
database object — the DB surface evaluated here is identical to P13-A.

## 1. Proven facts (live read-only evidence today)

- Ref exactly `knniommcyyhbyiwljisk` (`micronestmicrotoolsesports`,
  `ACTIVE_HEALTHY`, PG `17.6.1.171`, `ap-northeast-1`, linked) — CLI
  `projects list` + MCP `list_migrations`/`list_tables`.
- Remote ledger: 9 versions (`01`, `02` + 7 G1 dashboard stamps) via CLI +
  MCP — identical sets. Local: 20 files (`01–02` matched; `03–09` + D1 `01–04`
  + P9 `05–06` + P11 `01–03` + P13 `04–05` local-only).
- Remote schema = G1-complete: 4 tables (0/0/1/0 rows, `bgmi` seed intact),
  11 policies, 3 `updated_at` triggers, 7 G1 functions with the approved
  INVOKER/DEFINER split, advisor posture matching the approved design.
  No `platform_admins`/`organizers`/`tournaments`/queue tables: D1/P9/P11/P13
  genuinely unapplied. Zero user data.
- G1 reconciliation (§07): seven dashboard versions map 1:1 by name to local
  `03–09`; every promised object present; no extra G1 object. Residuals
  (grant-surface exactness, index inventory, function-body text) recorded —
  none blocks the recommendation.
- Switches OFF: `ORGANIZER/TOURNAMENT/MODERATION_WRITES_ENABLED = false`
  re-grepped in writers + test pins today.

## 2. Static analysis (migration-text evidence, no DB execution)

- Ordered dependency graph acyclic (§08): G1 → D1 `01→02→03→04` → P9 `05→06` →
  P11 `01→02→03` → P13 `04→05`. No duplicate tables/policies, no forward
  references, three intentional single-replacement functions with verbatim
  restore notes.
- Additive posture throughout except the three documented replacements
  (`is_super_admin`, `search_teams`, `enforce_tournament_lifecycle` — each
  behavior-preserving outside its approved hardening/enforcement delta).
- RLS/grants least-privilege (§08.5): default-deny everywhere new; no anon table
  policies; no P13 table grants; no DELETE/`organizer_members`/
  `verification_cases` policies; all new functions `search_path = ''` + revokes.
- F-02 (§10): 20-field matrix verified field-by-field against migration text +
  domain mirror + test pins; 19-vs-20 rationale pinned; version/hash/CHECK/
  validator/self-review/unpublish semantics pinned; trigger-ordering disjoint.

## 3. Simulated tests (TypeScript, no database)

- `isApprovalBindingValid` / `requiredApprovalFor` (stale-replay, hash-divergence,
  wrong-type, inactive/member-reviewer rejections); `isSelfApproval`;
  `canRoleTransition` (bypass blocked, unpublish authorized, republish gated).
- Intake-schema spoof rejection (`reviewerId`/`decidedBy` unrepresentable).

## 4. Unverified runtime assumptions (explicitly NOT proven)

- Trigger firing, CHECK enforcement, validator/hash execution, version-bump
  overwrite, freeze coverage per field, two-session concurrency, audit atomicity
  / fault injection, per-role RLS allow/deny, PostgREST codes + RPC EXECUTE
  posture, JWT/`auth.uid()` binding, suspension-between-decision-and-publish.
- These require the authorized post-push battery (prior `09-postgres-test-plan`
  case list F/P/R/L, unexecuted) with dedicated test identities + cleanup.

## 5. Exact proposed migration sequence and preconditions

Preconditions (all verified green today): ref match, linked, ACTIVE_HEALTHY;
remote = G1-complete (§07); local order sort-clean; HEAD/worktree preserved;
switches OFF; no sibling access; no reset ever required.

| # | Local file | Expected remote effect | Dependencies | Data impact | RLS/security | Rollback | Runtime evidence today | Uncertainty |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | (ledger) local `03–09` | NONE (ledger-only mark, no DDL) | §07 mapping accepted | none | none | re-mark ledger | object presence, not body/grant bytes | §07 residuals |
| 1 | D1 `01` | 3 tables, 4 fns/triggers, RLS+revokes | G1 `app_users` | none (new) | default-deny | reverse-drop | static only | live execution open |
| 2 | D1 `02` | 5 tables, 4 fns, 14 policies, grants | `01`, G1 | none (new) | member/captain-gated | reverse-drop | static only | same |
| 3 | D1 `03` | Replace 2 fns + 5 policies; add 3 fns + 2 triggers | `01–02` | none (tightening) | narrows only | verbatim restore | static only | same |
| 4 | D1 `04` | Tighten 1 policy; 6 indexes | `02–03` | none | narrows + read-path | restore + drop idx | static only | same |
| 5 | P9 `05` | 3 tables (tournaments default-deny, no policies), 4 policies, RPC pair, triggers | G1 + D1 | none (new) | gated, no anon | reverse-drop | static only | same |
| 6 | P9 `06` | Lifecycle v1 + trigger, 3 policies, RPC pair | `05` | none | member-gated, moderator paths blocked | drop trigger/fn/policies | static only | same |
| 7 | P11 `01` | Trust-guard trigger | D1 authority + P9 organizers | none | narrows | drop trigger/fn | static only | same |
| 8 | P11 `02` | Published-freeze trigger | P9 tournaments | none | narrows (20 fields) | drop trigger/fn | static only | same |
| 9 | P11 `03` | 3 queue tables, RLS on, NO policies/grants (inert) | P9 + G1 | none | inert | drop tables | static only | same |
| 10 | P13 `04` | Version col, hash + validator fns, decision cols + CHECK | P9 + P11 + D1 | none (default/nullable) | no grants, revoked fns | drop fns/cols/CHECK | static+sim | live enforcement open |
| 11 | P13 `05` | `provision_organizer`, 6 policies, lifecycle replacement | all above + `04` | none | 6 gated policies only | drop + re-apply P9-06 body | static+sim | live enforcement open |

Execution order (AUTHORIZATION REQUIRED — NOT run here):
Step 0 authorizations (§6) → Step 1 forward-only repair of exactly the 7 local
G1 versions → verify `migration list` flip → Step 2 `db push` (exactly the 11
files above, in order) → Step 3 post-push read-only inventory + suites +
advisors → Step 4 controlled runtime battery (switches still OFF) →
Step 5 bootstrap/switch sequence per P12 (NOT P13-B). Abort on any ref mismatch,
any reset/destructive prompt, or any ledger drift. Activation without
application writes is safe by design (gated paths only, default-deny preserved).

## 6. Remaining authorization requirements (exact)

1. Stage-3/4 authorization per P12 (owner sign-off on §§07–08–10 + this plan with
   exact file hashes; named applier; target ref `knniommcyyhbyiwljisk`;
   rollback readiness). Covers G1 repair (ledger mutation) + push (schema
   mutation). NOT granted in P13-A or P13-B — the single gate for everything
   downstream.
2. Separate explicit approval of the §07 version/name mapping before any
   `migration repair` (constraint: no repair without separately approved exact
   mapping — this doc is the proposed mapping, not the approval).
3. Post-push controlled runtime battery authorization (test identities `rt-*`,
   write probes + cleanup scope, audit-row retention as evidence, switches
   remain OFF, no launch/switch-flip implied).
4. D-05/D-02/D-09 stay deferred — no verification workflow, linkage, media, or
   evidence workarounds in any window; `verification_cases` stays inert.
5. No switch flips, no commits/pushes/deployments authorized in this phase.

## 7. No-write confirmation

- Executed: `git` reads, `Get-ChildItem`, local `read/grep/glob`; CLI
  `projects list`, `migration list`, `status` probe; MCP `list_migrations`,
  `list_tables`, `execute_sql` (SELECT-only), `get_advisors` (security).
- NEVER executed: `db push/reset`, `migration repair`, MCP `apply_migration`,
  any DDL/DML/DDL-adjacent write, branch/project creation, commit/push/deploy,
  service-role or secret exposure, sibling-project access, historical-migration
  edits, switch changes. `supabase status` Docker error is an environment
  observation, not a mutation.

## Verdict: READY FOR CONTROLLED APPLICATION

The primary project can safely receive the pending migrations WITHOUT a
destructive reset, via the exact repair-then-push sequence above — this is a
technical-application verdict, NOT a launch pass. Conditions: the §6
authorizations must be recorded first; execution must follow the §5 order with
abort rules; the post-push runtime battery must pass before any switch flip or
launch claim. Runtime verification today is BLOCKED (§09); F-02 acceptance rests
on static + simulated evidence only (§10). Next step: record the stage-3/4
authorization (named applier + ref + rollback readiness), then execute §5
Steps 0–2 with the §09 battery as the evidence log.
