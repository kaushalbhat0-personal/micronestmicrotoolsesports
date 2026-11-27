# 08 — Pending migration dependency map (P13-B, static analysis, 2026-11-12)

Status: PLAN ONLY. No migration applied, repaired, reset, or pushed. Historical
files preserved byte-for-byte; no silent rewrites. Order below is filename sort
= intended apply order (verified acyclic; every referenced object exists when its
consumer runs).

## 1. Ordered chain

```
G1 (live: 01, 02 + 7 dashboard versions ≡ local 03–09 after repair)
 └─ D1 20261112000001_d1_admin_foundation          (platform_admins, is_super_admin v1, admin_audit_logs, cron_run_ledger)
     ├─ D1 20261112000002_d1_teams_discovery       (teams, team_members, recruitment_posts, applications, reports; is_team_member/captain; search_teams/get_team_by_slug)
     ├─ D1 20261112000003_d1_security_remediation (replaces is_super_admin [fail-closed] + search_teams [LIKE-escape]; freezes teams columns; withdraw-only; denies team_members INSERT; hardens triggers)
     ├─ D1 20261112000004_d1_insert_boundary_indexes (application-insert CHECK fix; 6 read-path indexes)
     ├─ P9 20261112000005_p9_organizer_foundation  (organizers, organizer_members, tournaments TABLE [RLS on, no policies yet], organizer RPC pair, trust/lifecycle-adjacent triggers)
     │    └─ P9 20261112000006_p9_tournament_link  (enforce_tournament_lifecycle v1 + trg_tournaments_lifecycle; 3 tournament policies; tournament RPC pair)
     │         ├─ P11 20261113000001_p11_f01_trust_guard        (prevent_unprivileged_trust_change + trigger; revokes)
     │         ├─ P11 20261113000002_p11_f02_published_integrity (freeze_published_tournament_content + trigger; revokes)
     │         ├─ P11 20261113000003_p11_moderation_queue        (moderation_reports, verification_cases, moderation_decisions + append-only guard; RLS on, NO policies, NO grants — inert)
     │         │    ├─ P13 20261113000004_p13_f02_snapshot      (submission_version + tournament_content_hash + decision binding CHECK + tournament_review_approval_valid; revokes)
     │         │    └─ P13 20261113000005_p13_activation        (provision_organizer; 6 queue policies; lifecycle REPLACEMENT with snapshot enforcement)
```

P14-B4 (Player Directory) added no migration file — chain end unchanged.

## 2. Per-file dependency, impact, and rollback

| File | Creates / replaces | Depends on | Data impact | RLS / security impact | Rollback |
| --- | --- | --- | --- | --- | --- |
| D1 `01` | Tables `platform_admins`, `admin_audit_logs`, `cron_run_ledger`; fns `is_super_admin` (v1), 3 trigger fns + 4 triggers; RLS on, revokes | G1 `app_users` (FK target) | None (new tables, zero rows remotely) | Default-deny; no anon/authenticated table policies; `is_super_admin` EXECUTE to authenticated only | Drop triggers/fns/tables in reverse order |
| D1 `02` | Tables `teams`, `team_members`, `recruitment_posts`, `applications`, `reports`; fns `is_team_member/captain`, `search_teams`, `get_team_by_slug`; 14 policies; grants | G1 `app_users`, `games`; `handle_updated_at` (G1) | None (new tables) | Member/captain-gated RLS; no anon base reads; RPC pair anon+authenticated EXECUTE | Drop policies/triggers/tables/fns in reverse order |
| D1 `03` | REPLACES `is_super_admin` (active-status join, fail-closed), `search_teams` (LIKE-escape), 5 policies; ADDS 3 trigger fns + 2 triggers; revokes | `01`, `02` objects | None (no data rewrite; policy/grant tightening only) | Tightens only: withdraw-only, no direct membership INSERT, column-level UPDATE grants, trigger hardening | Re-apply `01`/`02` bodies verbatim for the replaced functions/policies; drop added triggers/fns; restore grants |
| D1 `04` | Tightens `applications applicant insert` (decision-metadata NULL); 6 indexes `if not exists` | `02`/`03` policies | None | Narrows one policy; indexes read-path only | Drop policy → restore `03` text; drop indexes |
| P9 `05` | Tables `organizers`, `organizer_members`, `tournaments` (structure + RLS on, NO tournament policies yet); 4 organizer/member policies; RPC pair + `escape_organizer_like`; triggers `trg_organizers_updated_at`, `trg_organizers_no_identity_change`, 3 owner-mutation triggers; grants | G1 `app_users`, `games`; D1 `is_super_admin` (not yet used); `handle_updated_at` | None (new tables); `tournaments` created WITHOUT policies — default-deny from birth, no exposure window | Organizer/member-gated RLS; no anon table policies; RPCs anon+authenticated | Drop in reverse dependency order |
| P9 `06` | REPLACES nothing (new fn `enforce_tournament_lifecycle` v1) + `trg_tournaments_lifecycle`; 3 tournament policies; RPC pair; grants | `05` tables + `organizer_members` + `app_users` | None | Member-gated writes; no DELETE; lifecycle blocks all moderator transitions until a later migration | Drop trigger/fn/policies/RPCs; table stays |
| P11 `01` | ADDS `prevent_unprivileged_trust_change` + trigger; revokes | D1 `is_super_admin`; P9 `organizers` | None | Narrows: `trust_state` moderator-only, fail-closed; no grant/policy change | Drop trigger + fn |
| P11 `02` | ADDS `freeze_published_tournament_content` + trigger; revokes | P9 `tournaments` | None | Narrows: 20-field freeze while `published` (incl. `published_at`); no grant/policy change | Drop trigger + fn |
| P11 `03` | Tables `moderation_reports`, `verification_cases`, `moderation_decisions` + append-only guard; RLS on, NO policies, NO grants; 2 partial-unique indexes | P9 `organizers` (FK, verification_cases only); G1 `app_users` (reporter/reviewer FKs) | None | Inert by design: nothing readable/writable via API roles until the authority migration | Drop 3 tables + guard fn |
| P13 `04` | ADDS `tournaments.submission_version`, `tournament_content_hash`, decision columns + CHECK, `tournament_review_approval_valid`; revokes | P9 `tournaments`; P11 `moderation_decisions`, `platform_admins` (D1), `organizer_members` (P9), `app_users` | None (nullable/DEFAULT columns; no backfill needed — tables empty remotely) | No policies; no grants; both fns revoked from all API roles (trigger-reachable only) | Drop validator + hash fns; drop 3 columns + CHECK |
| P13 `05` | ADDS `provision_organizer` (EXECUTE to authenticated only) + 6 queue policies; REPLACES `enforce_tournament_lifecycle` (P9-body-identical except moderator branches + version bump) | D1 `is_super_admin`; P9 `organizers`/`organizer_members`/`tournaments`; P11 queue tables; P13 `04` hash/validator | None | 6 gated policies only (reporter insert, moderator select/update, decision insert/select, member select); no table grants; no anon/DELETE/`organizer_members`/`verification_cases` policy | Drop 6 policies + `provision_organizer`; re-apply P9 `06` lifecycle body verbatim (restore source pinned in file header) |

## 3. Duplicate / conflict analysis (static, whole chain grepped)

- No duplicate `CREATE TABLE`: every table name created exactly once
  (`platform_admins`/`admin_audit_logs`/`cron_run_ledger` in D1-01; team tables
  in D1-02; `organizers`/`organizer_members`/`tournaments` in P9-05; queue
  tables in P11-03; only *columns* added later). `reports` (D1-02, team-scoped)
  vs `moderation_reports` (P11-03, tournament/organizer-scoped) are distinct
  tables — no conflict.
- No duplicate policy names on the same table; `DROP POLICY IF EXISTS` guards
  precede every D1-03/04 policy replacement.
- Three intentional function replacements, each `CREATE OR REPLACE` with no
  signature change: `is_super_admin()` (D1-01 → D1-03, fail-closed hardening),
  `search_teams` (D1-02 → D1-03, LIKE-escape parity), `enforce_tournament_lifecycle`
  (P9-06 → P13-05, moderator branches + version bump; P9 behavior byte-identical
  for all non-privileged paths including messages and fall-through). Each is the
  documented single-replacement pattern with verbatim-restore rollback.
- No forward references: `is_super_admin` (D1-01/03) precedes every consumer
  (P11-01, P13-04/05); queue tables (P11-03) precede P13-04/05; hash/validator
  (P13-04) precede P13-05. No cycles.

## 4. Trigger ordering

- P9-06: `trg_tournaments_lifecycle` (BEFORE INSERT OR UPDATE).
- P11-02: `trg_tournaments_freeze_published` (BEFORE UPDATE) — sorts first
  alphabetically at the same level; concerns are disjoint (freeze governs
  *content*, lifecycle governs *transitions*), so firing order cannot change the
  net effect: any forbidden combination raises either way.
- P13-05 replaces only the lifecycle function body; the trigger row persists —
  no trigger recreation gap. `submission_version` bump (`draft→submitted`) and
  validator calls (privileged transitions) live in disjoint branches of the same
  function — no self-conflict.
- Trust guard (P11-01, BEFORE INSERT OR UPDATE on `organizers`) and owner-mutation
  guards (P9-05) are on different tables from the tournament triggers — no
  cross-table ordering concern.

## 5. RLS, grants, and authority dependencies

- `is_super_admin()` (D1-01, hardened D1-03: `platform_admins` + active
  `app_users`, fail-closed for missing/suspended/anon): sole moderator-authority
  primitive. Consumed by P11-01 trigger, P13-04 validator, P13-05
  `provision_organizer` + 4 of 6 policies + all 4 privileged lifecycle branches.
- Active-account checks (`app_users.status = 'active'`): present in every
  member/reporter/applicant insert path and re-checked at transition time in the
  validator (suspension between decision and publish fails the transition).
- Grants: D1 team tables and P9 organizer/tournament tables grant narrowly to
  `authenticated`; P11 queue tables grant nothing; P13-04/05 grant no table
  access (only `provision_organizer` EXECUTE to authenticated — authority still
  gated in-body). No anon table policy anywhere; no DELETE policy in P13-05;
  no `organizer_members` write policy (F-03 posture preserved); no
  `verification_cases` policy (D-05 deferred — table stays inert).
- All new trigger/validator/hash functions: `security invoker` except the three
  approved DEFINERs (`is_super_admin`, `tournament_review_approval_valid`,
  `provision_organizer`) + pre-existing G1 DEFINER RPCs; every new function sets
  `search_path = ''` and carries explicit revokes.

## 6. Lock / overwrite / exposure assessment

- Zero user rows remotely: no row locks, no overwrite, no exposure possible from
  any pending file. `bgmi` seed untouched by all downstream files (no file
  references `games` writes).
- Push-time locks are the ordinary per-file-transaction DDL locks (each file in
  its own transaction; a mid-push failure leaves an applied prefix that is
  resumable after diagnosis — the ledger shows exactly where it stopped).
- No migration backfills, rewrites, or deletes data; no migration flips any of
  the three write switches (verified `false` in source + test pins today).
