# 12 — P13-C0 exact migration manifest (read-only, 2026-11-12)

No repair, no push, no reset, no remote DDL/DML executed in this phase.
All hashes computed locally via `Get-FileHash -Algorithm SHA256` on the
exact files that `db push` would send. Migration files NOT modified.

## 1. Exact target verification (Phase 1)

- Branch: `new-platform` (`git branch --show-current`).
- HEAD: `376df8f651f3142dcaacb2ddbcbf269b38196040` — matches the expected
  HEAD `376df8f` for this phase. Note: P13-A evidence was recorded at
  `01893ae`; the single commit on top (`376df8f`, "fix(release): drop
  invalid vercel.json comment blocking Vercel schema validation") touches
  no migration file and no database object. `git log` confirms `376df8f`
  sits directly on `01893ae`.
- Worktree: single (`git worktree list` → repo root only, `376df8f
  [new-platform]`). All pre-existing uncommitted work preserved (`M`
  + `??` entries incl. all P10–P14 additions and the full
  `supabase/migrations` set). No commit, push, or deploy performed.
- Linked project: `npx supabase projects list` returns exactly
  id/ref `knniommcyyhbyiwljisk`, name `micronestmicrotoolsesports`,
  region `ap-northeast-1`, status `ACTIVE_HEALTHY`, PG `17.6.1.171`,
  `linked: true`. Matches the approved evidence. No other project touched;
  the sibling `whitelabel-lms` project was never accessed (it did not even
  appear in this phase's single-project listing output).
- Remote migration ledger (`npx supabase migration list`, read-only):
  `20261110000001`/`02` matched on both sides; 18 local-only unapplied;
  7 remote-only dashboard stamps
  (`20261110135602`, `20261110135654`, `20261110141108`, `20261110143759`,
  `20261111072251`, `20261111090645`, `20261111091947`). Identical to the
  P13-B ledger — no drift.
- Local inventory (`Get-ChildItem supabase/migrations`): 20 files, byte
  sizes unchanged from P13-B record where previously recorded.
- Write switches: `ORGANIZER_WRITES_ENABLED`, `TOURNAMENT_WRITES_ENABLED`,
  `MODERATION_WRITES_ENABLED` all `false` in writers and test-pinned
  (`src/features/*/server/*-writer.ts`, `src/features/*/tests/*`,
  `src/app/**/routes.test.ts`). No migration flips any switch.

Result: target identity, HEAD, ledger, and file set all match the approved
evidence. No stop condition triggered. Proceed to mapping/manifest.

## 2. Ordered push manifest — the exact 11 pending migrations

Filename sort order = apply order (verified acyclic in P13-B §08).
`Version` = the 14-digit stamp `db push` keys on.

| # | Exact filename | Version | SHA-256 | Bytes |
| - | -------------- | ------- | ------- | ----- |
| 1 | `20261112000001_d1_admin_foundation.sql` | 20261112000001 | `90e6f4633a96eb4caa320053c4657dfd0623fe42831287adef4767589664b192` | 5716 |
| 2 | `20261112000002_d1_teams_discovery.sql` | 20261112000002 | `2f4e0ac6686f620d3370532dfe0c02d4632cd5fc5288b8d083a92b034c37e79d` | 15542 |
| 3 | `20261112000003_d1_security_remediation.sql` | 20261112000003 | `5209c028f2091da643fbfe441f7f2b5357c943d9d625a84a807e0b9e48d741d8` | 15336 |
| 4 | `20261112000004_d1_insert_boundary_indexes.sql` | 20261112000004 | `554ed952c2c16267aa2e25e8d90c6b3faa2f0b12979510190071b7554b0344c7` | 2447 |
| 5 | `20261112000005_p9_organizer_foundation.sql` | 20261112000005 | `b8b747c6e3a174bfa7fb713c659c21b21bc7f25ae1e7b386707e9ce7a1be9ef2` | 17106 |
| 6 | `20261112000006_p9_tournament_link.sql` | 20261112000006 | `12cc0c8d74480a9dcd61cadc347580a38c4bf07c6d6c43410d698448fa948054` | 12762 |
| 7 | `20261113000001_p11_f01_trust_guard.sql` | 20261113000001 | `3ae4054c86552f7f27af69708bfb9834a2eadfe3229e2f79cdfb47362a207b95` | 3689 |
| 8 | `20261113000002_p11_f02_published_integrity.sql` | 20261113000002 | `a39178066d934b6ad13086ae1ce89b890913aed8552695c1bf8b504eb6b01b43` | 4945 |
| 9 | `20261113000003_p11_moderation_queue.sql` | 20261113000003 | `1ca6e2fd857bb1e461039a6da279622c7af2bf9062f68aeb6a76672fe0f7a878` | 7216 |
| 10 | `20261113000004_p13_f02_snapshot.sql` | 20261113000004 | `aa3dad7ccf8084546c6f99002d6f5391626a175f662b9a8fd3b6ba433eb0dc73` | 8414 |
| 11 | `20261113000005_p13_activation.sql` | 20261113000005 | `e2289ce09195f6f81cfd69d767a68ad963272ea90f39ffc668400267e9fff0ae` | 11946 |

Cross-check: the five prefixes recorded in P13-A §01
(`3ae4054c8655`, `a39178066d93`, `1ca6e2fd857b`, `b8b747c6e3a1`,
`12cc0c8d7448`) all match the full hashes above. No file changed since.

## 3. Per-file dependency and database-effect record

Counts below re-verified today by case-insensitive match over the exact
files (`CREATE TABLE/POLICY/TRIGGER`, `CREATE [OR REPLACE] FUNCTION`,
`GRANT`/`REVOKE` line starts, `CREATE INDEX`, `ALTER TABLE`).
Two honest count corrections vs P13-B §08 prose are flagged with (*).

1. **D1 01 — admin foundation** (`...01`). Depends on: G1 `app_users`
   (FK target). Effects: 3 tables (`platform_admins`, `admin_audit_logs`,
   `cron_run_ledger`); 4 functions (`is_super_admin` v1,
   `prevent_admin_audit_mutation`, `enforce_cron_run_ledger_lifecycle`,
   `prevent_cron_ledger_delete`); 4 triggers; 0 policies; 13 GRANT/REVOKE
   lines. Tables: YES. Policies: NO. Grants: YES (revokes + narrow).
   Functions: YES. Triggers: YES. RLS default-deny, no anon/authenticated
   table policies. Data impact: none (new tables, zero remote rows).
2. **D1 02 — teams** (`...02`). Depends on: G1 `app_users`, `games`;
   D1 01. Effects: 5 tables (`teams`, `team_members`,
   `recruitment_posts`, `applications`, `reports`); 15 policies (*; §08
   prose said 14 — the file contains 15 `CREATE POLICY` statements:
   teams 3, team_members 4, recruitment_posts 4, applications 3,
   reports 1); 4 functions (`is_team_member`, `is_team_captain`,
   `search_teams`, `get_team_by_slug`); 3 triggers; 28 GRANT/REVOKE lines.
   Tables/Policies/Grants/Functions/Triggers: ALL YES. Member/captain-gated
   RLS, no anon base-table reads. Data impact: none (new tables).
3. **D1 03 — security remediation** (`...03`). Depends on: D1 01–02
   objects. Effects: 0 tables; 6 `CREATE POLICY` statements (*; §08 prose
   said 5 — the file creates 6: `applications applicant withdraw` rewrite,
   `team_members captain update/delete`, `recruitment_posts captain
   insert/update/delete`) plus 6 `DROP POLICY IF EXISTS` guards including
   the deliberate drop-without-recreate of `team_members captain insert`
   (F-T04 deny of direct membership INSERT); 7 `CREATE OR REPLACE FUNCTION`
   statements (replaces `is_super_admin` fail-closed hardening,
   `search_teams` LIKE-escape parity, plus trigger-guard functions);
   2 triggers; 27 GRANT/REVOKE lines. Policies/Grants/Functions/Triggers:
   YES. Tables: NO. Tightening only. Data impact: none.
4. **D1 04 — insert boundary and indexes** (`...04`). Depends on: D1
   02–03 policies. Effects: 1 policy (`applications applicant insert`
   rewrite with decision-metadata NULL, after `DROP IF EXISTS`); 0 tables;
   0 functions; 0 triggers; 0 GRANT/REVOKE lines; 6 `CREATE INDEX IF NOT
   EXISTS` (read-path). Policies: YES (1). Grants/Functions/Triggers/
   Tables: NO. Data impact: none.
5. **P9 05 — organizer and tournament foundation** (`...05`). Depends on:
   G1 `app_users`, `games`; D1. Effects: 3 tables (`organizers`,
   `organizer_members`, `tournaments` — created with RLS on, `tournaments`
   with NO policies: default-deny from birth); 4 policies (organizers
   member-select / owner-insert / admin-update, organizer_members
   self-select); 5 functions (`prevent_organizer_identity_change`,
   `prevent_owner_mutation`, `escape_organizer_like`, `search_organizers`,
   `get_organizer_by_slug`); 6 triggers (incl. `updated_at` + owner-mutation
   guards); 6 indexes; 18 GRANT/REVOKE lines. ALL categories YES.
   No anon table policies. Data impact: none (new tables).
6. **P9 06 — lifecycle and policies** (`...06`). Depends on: P9 05 tables
   + `organizer_members` + `app_users`. Effects: 0 tables; 3 policies
   (`tournaments member select/insert/update`); 3 functions
   (`enforce_tournament_lifecycle` v1, `search_tournaments`,
   `get_tournament_by_slug`); 1 trigger (`trg_tournaments_lifecycle`);
   GRANT/REVOKE lines YES (6, incl. tournament table grant to
   authenticated minus delete/truncate + RPC EXECUTE to anon/authenticated).
   Functions/Triggers/Policies/Grants: YES. Tables: NO. No DELETE policy;
   moderator-transition paths stay blocked until P13 05. Data impact: none.
7. **P11 01 — trust guard** (`...01`). Depends on: D1 `is_super_admin`,
   P9 `organizers`. Effects: 0 tables; 0 policies; 0 table grants;
   1 function (`prevent_unprivileged_trust_change`); 1 trigger
   (`trg_organizers_trust_guard`); 3 REVOKE lines (function revoked from
   public/anon/authenticated — trigger-reachable only). Functions/Triggers:
   YES. Tables/Policies/Grants: NO (revokes only). Narrows
   `trust_state` to moderator-only, fail-closed. Data impact: none.
8. **P11 02 — published integrity** (`...02`). Depends on: P9
   `tournaments`. Effects: 0 tables; 0 policies; 0 table grants;
   1 function (`freeze_published_tournament_content`, 20-field freeze);
   1 trigger (`trg_tournaments_freeze_published`); 3 REVOKE lines.
   Functions/Triggers: YES. Tables/Policies/Grants: NO. Data impact: none.
9. **P11 03 — moderation queue** (`...03`). Depends on: P9 `organizers`
   (FK), G1 `app_users` (reporter/reviewer FKs). Effects: 3 tables
   (`moderation_reports`, `verification_cases`, `moderation_decisions`);
   0 policies; 0 table grants (12 REVOKE-only lines — tables inert by
   design); 1 function (`prevent_moderation_decision_mutation` append-only
   guard); 1 trigger; 2 partial-unique indexes. Tables/Functions/Triggers:
   YES. Policies/Grants: NO. Data impact: none.
10. **P13 04 — F-02 snapshot support** (`...04`). Depends on: P9
    `tournaments`; P11 `moderation_decisions`; D1 `platform_admins`;
    P9 `organizer_members`; G1 `app_users`. Effects: 0 new tables;
    `ALTER TABLE tournaments` (+`submission_version`, decision-binding
    columns, CHECK) and `ALTER TABLE moderation_decisions` (+hash/version
    columns); 2 functions (`tournament_content_hash`,
    `tournament_review_approval_valid`); 0 policies; 0 table grants
    (6 REVOKE-only lines); 0 triggers. Functions: YES. Tables (new)/
    Policies/Grants/Triggers: NO. Additive only; nullable/DEFAULT columns,
    no backfill needed (tables empty remotely). Data impact: none.
11. **P13 05 — activation and lifecycle replacement** (`...05`). Depends
    on: all of the above + P13 04 hash/validator. Effects: 0 tables;
    6 policies (reporter insert, moderator select/update, decision
    insert/select, member select — exact names in §13 doc 14); 2 functions
    (`provision_organizer` new, EXECUTE to authenticated only;
    `enforce_tournament_lifecycle` REPLACEMENT — P9-body-identical except
    moderator branches + version bump); 0 triggers (lifecycle trigger row
    persists, only the function body is replaced); 2 GRANT/REVOKE lines.
    Policies/Grants/Functions: YES. Tables/Triggers: NO. No anon/DELETE/
    `organizer_members`/`verification_cases` policy (D-05 stayed deferred).
    Data impact: none.

## 4. Order confirmation

Filename-sort order of the 11 versions is strictly increasing
(`...01` → `...05`, `...06`, `...01` → `...05` across the
`20261112`/`20261113` date boundary — verified: `20261112000006 <
20261113000001 < 20261113000005`). Every consumer runs after its
dependencies (§08 chain: D1 01→02→03→04 → P9 05→06 → P11 01/02/03 →
P13 04→05). No forward references, no duplicate table/policy creation
across the 11 files, three intentional single-replacement functions with
verbatim-restore rollback (`is_super_admin`, `search_teams`,
`enforce_tournament_lifecycle`).

Manifest closed: exactly these 11 files, in this order, with the hashes
above. No other version may appear in the push.
