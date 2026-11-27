# 07 — G1 migration history reconciliation (P13-B, read-only, 2026-11-12)

Method: `git` worktree inspection, `npx supabase projects list`, `npx supabase
migration list`, Supabase MCP `list_migrations` / `list_tables` /
`execute_sql` (SELECT-only: `pg_policies`, `information_schema.triggers`,
`pg_proc`, row counts) / `get_advisors` (security). No repair, no push, no
DDL/DML, no branch/project creation, no commit/push/deploy. Sibling
`whitelabel-lms` appeared only in the project listing; every data call targeted
ref `knniommcyyhbyiwljisk`.

## 1. Preflight (preserved)

- Branch: `new-platform`; HEAD: `376df8f651f3142dcaacb2ddbcbf269b38196040`;
  single worktree (repo root). All pre-existing changes preserved
  (M + ?? entries incl. P10–P14 additions; full `supabase/migrations`
  set intact). No commit, push, or deploy performed.
- Project identity (confirmed before every Supabase operation):
  id/ref `knniommcyyhbyiwljisk`, name `micronestmicrotoolsesports`,
  org `ocib…`, region `ap-northeast-1`, status `ACTIVE_HEALTHY`,
  PG `17.6.1.171`, linked `true`. Matches the P13-A owner decision record
  (`docs/product-development/P12-owner-authorization/owner-approval-record.md`,
  D-06 qualified approval: inspection + controlled migration workflow only —
  NOT a blind-reset or data-destruction permission).
- P13-A evidence (`P13-implementation/01`, `06`) and P13-B prior passes
  (`07`, `08`, `09`, `10`, `11-p13-b-final-evidence-report`) re-read. P14-B4
  context noted: Player Directory implemented, frozen G1 12-column public
  projection preserved, `DirectoryReader` sole data path (static route audit
  `src/app/players/routes.test.ts`), no new migration files.
- Local migration set (20 files, `Get-ChildItem`): foundation `01–02`,
  G1 `03–09`, D1 `01–04`, P9 `05–06`, P11 `01–03`, P13 `04–05`. No file
  created, edited, renamed, or deleted in this phase.

## 2. Ledger status (verified live this phase)

CLI `migration list` (remote DB channel):

| Local | Remote | Meaning |
| ----- | ------ | ------- |
| `20261110000001` / `02` | same | baseline + storage — applied both sides |
| `20261110000003–07`, `20261111000008/09`, `20261112000001–04`, `20261112000005/06`, `20261113000001–05` | — | 18 local-only, unapplied |
| — | `20261110135602`, `20261110135654`, `20261110141108`, `20261110143759`, `20261111072251`, `20261111090645`, `20261111091947` | 7 dashboard-applied G1, names identical to local `03–09` with different version stamps |

MCP `list_migrations`: exactly 9 remote versions (`01`, `02` + the 7 above).
CLI and MCP sets agree. No D1/P9/P11/P13 version present remotely.

Remote schema (SELECT-only, re-verified today): exactly 4 tables —
`app_users` (0 rows), `player_profiles` (0), `games` (1 row: `bgmi` seed),
`player_game_profiles` (0). 11 G1 policies (app_users owner insert/select;
games public select; profiles/game-profiles owner CRUD incl. the 2 owner-DELETE
policies from file `08`). 3 `updated_at` triggers (G1). 7 G1 functions
(`ensure_app_user`, `create_player_profile`, `search_player_directory`,
`get_player_by_handle`, `set_player_discoverability`, `update_player_handle`,
`handle_updated_at`) with the approved DEFINER/INVOKER split. Advisor lints:
only the 2 approved anon-DEFINER WARNs (directory RPC pair, by design) + 4
authenticated-DEFINER notes. No `platform_admins`, no `organizers`, no
`tournaments`, no queue tables — D1/P9/P11/P13 genuinely unapplied. Zero user
data anywhere.

## 3. Mapping table (remote → local)

| Remote version | Remote name | Local migration | Content equivalence | Evidence (remote SELECT + local read) | Recommended action |
| --- | --- | --- | --- | --- | --- |
| `20261110135602` | `g1_identity_anchor` | `20261110000003_g1_identity_anchor.sql` (4610 B) | Same intent: `app_users` anchor + `ensure_app_user()` INVOKER + owner select/insert, no anon | Table `app_users`, trigger `trg_app_users_updated_at`, fn `ensure_app_user()` INVOKER, 2 owner policies present | Forward-only `repair --status applied` for local `03` after authorization; do NOT re-apply |
| `20261110135654` | `g1_identity_anchor_grant_tightening` | `20261110000004_g1_identity_anchor_grant_tightening.sql` (748 B) | Same intent: grant-only revoke of UPDATE-family on `app_users` | No owner-UPDATE policy remotely (only select/insert); grant delta not observable via policy inventory — file creates no object | Mark local `04` applied after authorization; lowest risk of the seven |
| `20261110141108` | `g1_player_profile` | `20261110000005_g1_player_profile.sql` (10929 B) | Same intent: `player_profiles` + `create_player_profile()` + owner select/insert/update, no delete at this layer | Table, `trg_player_profiles_updated_at`, fn INVOKER, 3 owner policies present (delete arrived in `08`) | Mark local `05` applied after authorization |
| `20261110143759` | `g1_game_catalogue` | `20261110000006_g1_game_catalogue.sql` (10314 B) | Same intent: `games` + `bgmi` seed + `player_game_profiles` + owner RLS + public catalogue select | Tables, `bgmi` seed row, 1 + 3 policies present; no function created here (correct) | Mark local `06` applied after authorization |
| `20261111072251` | `g1_public_projection` | `20261110000007_g1_public_projection.sql` (7958 B) | Same intent: RPC-only public reads, 2 DEFINER fns, anon+authenticated EXECUTE | Fns `search_player_directory` + `get_player_by_handle` DEFINER present; advisor EXECUTE posture matches approved design | Mark local `07` applied after authorization |
| `20261111090645` | `g1_owner_settings_lifecycle` | `20261111000008_g1_owner_settings_lifecycle.sql` (9431 B) | Same intent: `handle_changed_at` + 2 owner-DELETE policies + UPDATE tightening + 2 DEFINER settings fns | Column present; 11-policy total matches (7 pre-08 + 2 DELETE + 2 unchanged); `set_player_discoverability` + `update_player_handle` DEFINER present | Mark local `08` applied after authorization |
| `20261111091947` | `g1_handle_function_ambiguity_fix` | `20261111000009_g1_handle_function_fix.sql` (3577 B) | Same intent: one-line row-lock qualification in `update_player_handle` (42702 fix), no behavior change | Fn `update_player_handle(p_handle text)` DEFINER present; body-text diff not retrievable via allowed SELECT inventory | Mark local `09` applied after authorization; body-level diff stays a recorded residual (§4) |

## 4. Per-file comparison notes

- `03`: local creates table + trigger + function + 2 policies. All four object
  classes observed remotely. Local grant block vs managed-platform defaults is
  normalized by file `04`; no remote behavior gap observable.
- `04`: grant-only. Equivalence rests on name + on the absence of any
  owner-UPDATE path remotely. No object to inventory.
- `05`: local unique/partial indexes + trigger + function + policies. Remote
  inventory confirms table/trigger/function/policies; `pg_indexes` was not
  dumped in this read-only pass (optional follow-up; does not change the
  recommendation — re-application would error on existing objects either way,
  which is exactly why repair-before-push is mandatory).
- `06`: local seed `on conflict do nothing` + tableside objects + GIN/partial
  indexes. Remote confirms tables, seed row, 4 policies, function absence.
- `07`: local creates exactly the 2 DEFINER RPCs observed remotely with the
  expected anon/authenticated EXECUTE posture (advisor WARNs match the approved
  design, not drift).
- `08`: the only file that adds DELETE policies + `handle_changed_at` +
  settings DEFINERs. Remote 11-policy total, column, and function presence match
  exactly.
- `09`: single-function `CREATE OR REPLACE` + grant re-assert. Remote signature
  matches; the procedural-body delta (one qualified predicate) is not observable
  through the SELECT inventory used. Zero user rows exist, so no behavioral
  divergence is possible from this residual.

## 5. Residual ambiguities (honest, non-blocking)

1. Grant-surface exactness (`03`/`04`/`06`/`08`): `has_table_privilege` /
   `role_table_grants` not dumped. RLS deny-by-default makes any grant delta
   non-exploitable; strict grant diff stays open for a follow-up read-only pass.
2. Index inventory (`05`/`06`): `pg_indexes` not dumped. No functional impact on
   push safety (local files use plain `CREATE INDEX` — re-application would fail,
   which is why repair precedes push).
3. Function-body text (`09`, also `07`/`08` bodies): `pg_get_functiondef` not
   pulled. Name/signature/DEFINER/posture match; body diff is the known
   one-line qualification.
4. Remote `supabase_migrations` statement-level history beyond version+name not
   available via MCP; CLI ledger is version-only.

None of the four blocks the recommendation: every object the seven files promise
exists remotely, no extra G1 object exists, zero user rows.

## 6. Reconciliation recommendation (NOT executed)

- Do NOT touch the remote ledger in this phase (no authorization for repair;
  task constraint prohibits it). Ledger NOT modified here.
- After stage-3/4 authorization (named applier, target ref recorded):
  1. Optional read-only close-out: `pg_indexes`, `role_table_grants`,
     `pg_get_functiondef(update_player_handle)` via `execute_sql` SELECT.
  2. Forward-only `migration repair --status applied` for exactly the 7 local
     G1 versions (`…03 …04 …05 …06 …07 …08 …09` in local stamps).
  3. `migration list` must show all 7 rows flipped local↔remote before any push.
- `supabase db push` can operate safely ONLY after that repair: without it, push
  replays `CREATE TABLE app_users` etc. against live objects and fails. After
  repair, push scope is exactly D1 `01–04`, P9 `05–06`, P11 `01–03`,
  P13 `04–05` — all genuinely-new objects (verified absent remotely).
- No reset at any point: nothing in the ledger or schema requires or justifies
  one. Rollback of a ledger repair is re-marking (ledger-only, no data change);
  the repair itself changes no schema or data — but it still mutates the ledger
  and therefore still requires the separately approved exact mapping (this doc)
  plus stage-3/4 authorization before execution.
