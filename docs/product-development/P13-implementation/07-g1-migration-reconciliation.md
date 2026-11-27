# 07 — G1 migration reconciliation (P13-B, read-only, 2026-11-12)

Method: local file reads + `npx supabase migration list` (CLI) + MCP
`list_migrations`, `list_tables(verbose)`, `execute_sql` SELECT-only
(`pg_policies`, `information_schema.triggers`, `pg_proc`, counts, `games`
seed). No repair, no push, no DDL. Sibling `whitelabel-lms`
(`iwgefthgciddukqabkun`) listed only to confirm identity; never queried.

## 1. Ledger status (verified this phase)

- Project: `knniommcyyhbyiwljisk` / `micronestmicrotoolsesports`,
  `ACTIVE_HEALTHY`, PG 17.6.1.171, region `ap-northeast-1`. CLI `linked:true`.
- CLI `migration list`: local `20261110000001/02` match remote; local
  `03–09, 11…08/09, 12…01–04, 13…01–05` have empty remote; remote-only
  7 versions: `20261110135602, …135654, …141108, …143759, 20261111072251,
  …090645, …091947`.
- MCP `list_migrations`: exactly 9 remote versions (baseline + storage + 7 G1).
- Remote schema: 4 tables (`app_users` 0, `player_profiles` 0, `games` 1
  [`bgmi`], `player_game_profiles` 0); 11 policies; 3 `updated_at` triggers;
  7 functions; counts re-verified this phase via SELECT.

## 2. Mapping table (remote → local)

| # | Remote version | Remote name | Local file | Semantic equivalence | Object-level evidence (remote, SELECT) | Recommendation |
| - | -------------- | ----------- | ---------- | -------------------- | -------------------------------------- | -------------- |
| 1 | 20261110135602 | g1_identity_anchor | 20261110000003_g1_identity_anchor.sql | Same intent: `app_users` anchor + `ensure_app_user()` INVOKER + owner select/insert, no anon | Table `app_users` (6 cols, status CHECK, FK→auth.users), trigger `trg_app_users_updated_at`, fn `ensure_app_user()` INVOKER, policies `app_users owner select/insert` present | Mark local 03 applied (forward-only repair) after authorization; do NOT re-apply |
| 2 | 20261110135654 | g1_identity_anchor_grant_tightening | 20261110000004_g1_identity_anchor_grant_tightening.sql | Same intent: revoke UPDATE-family from authenticated on `app_users` | Consistent with no owner-UPDATE policy remotely (only select/insert policies on `app_users`); grant-level diff not observable via SELECT policy inventory, file is grant-only with no object creation | Mark local 04 applied after authorization; no behavioral risk |
| 3 | 20261110141108 | g1_player_profile | 20261110000005_g1_player_profile.sql | Same intent: `player_profiles` + `create_player_profile()` + owner select/insert/update, no delete | Table `player_profiles` (handle CHECK, country allowlist, `handle_changed_at` exists via later file), fn `create_player_profile()` INVOKER, 4 owner policies incl. update, no delete policy at this layer (delete added in #6) | Mark local 05 applied after authorization |
| 4 | 20261110143759 | g1_game_catalogue | 20261110000006_g1_game_catalogue.sql | Same intent: `games` + `bgmi` seed + `player_game_profiles` + owner RLS, public catalogue select | Tables `games`/`player_game_profiles`, seed row `bgmi/Battlegrounds Mobile India/BGMI/active`, policies `games public select` + 3 `player_game_profiles` owner policies (select/insert/update, no delete) | Mark local 06 applied after authorization |
| 5 | 20261111072251 | g1_public_projection | 20261110000007_g1_public_projection.sql | Same intent: RPC-only public reads, 2 DEFINER fns, anon+authenticated EXECUTE | Fns `search_player_directory` + `get_player_by_handle` DEFINER present; advisor lints confirm anon/authenticated EXECUTE on both (WARN, by design) | Mark local 07 applied after authorization |
| 6 | 20261111090645 | g1_owner_settings_lifecycle | 20261111000008_g1_owner_settings_lifecycle.sql | Same intent: `handle_changed_at` + 2 owner DELETE policies + column UPDATE tightening + 2 DEFINER settings fns | Column `handle_changed_at` present; policies `player_profiles/player_game_profiles owner delete` present (11-policy total matches); fns `set_player_discoverability` + `update_player_handle` DEFINER present | Mark local 08 applied after authorization |
| 7 | 20261111091947 | g1_handle_function_ambiguity_fix | 20261111000009_g1_handle_function_fix.sql | Same intent: qualify row-lock predicate in `update_player_handle` (42702 fix), no behavior change | Fn `update_player_handle(p_handle text)` present, DEFINER; body text not retrievable via allowed SELECT inventory — equivalence rests on (a) name/signature match, (b) P13-A file read, (c) zero user rows + green app suites | Mark local 09 applied after authorization; body-level diff stays a recorded residual (see §4) |

## 3. Comparison notes per file

- 03: local creates table + trigger + function + 2 policies. All four object
  classes observed remotely. Local grant block (`grant select,insert,delete`)
  vs managed-platform defaults is normalized by file 04; no remote behavior
  gap observable.
- 04: grant-only file. No table/policy/function/trigger to inventory.
  Equivalence is by name + by absence of any owner-UPDATE path remotely.
  Lowest risk of the seven.
- 05: local unique index `player_profiles_handle_lower_uniq`, partial index,
  trigger, function, 3 policies, grants. Remote inventory confirms table,
  trigger, function, policies; index-level confirmation was not queried
  (pg_indexes SELECT possible in a follow-up read-only pass; not required
  to change the recommendation).
- 06: local seed `on conflict do nothing` + 4 tableside objects + GIN/partial
  indexes. Remote confirms tables, seed row, 4 policies, function absence
  (none created here — correct).
- 07: local creates exactly the 2 DEFINER RPCs observed remotely with the
  expected `anon,authenticated` EXECUTE posture (advisor WARNs match the
  approved design, not drift).
- 08: local is the only file that adds DELETE policies + `handle_changed_at`
  + settings DEFINERs. Remote 11-policy total (7 pre-08 + 2 DELETE + 2
  unchanged = 11) and column/function presence match exactly.
- 09: single-function `CREATE OR REPLACE` + grant re-assert. Remote signature
  matches; procedural-body diff (one qualified predicate) is not observable
  through the SELECT inventory used. No user rows exist, so no behavioral
  divergence is possible from this residual.

## 4. Residual ambiguities (honest)

1. Grant-surface exactness (files 03/04/06/08): `has_table_privilege` /
  `information_schema.role_table_grants` were not dumped this phase. RLS
  deny-by-default makes any grant delta non-exploitable, but a strict
  grant-diff remains open for a follow-up read-only pass.
2. Index inventory (files 05/06): `pg_indexes` not dumped. No functional
  impact on push safety (indexes are `IF NOT EXISTS`-less `CREATE INDEX`
  in local files — re-application would error, which is exactly why
  repair-before-push is required).
3. Function-body text (file 09, also 07/08 bodies): `pg_get_functiondef`
  not pulled. Name/signature/DEF-mer/posture match; body diff is the known
  one-line qualification.
4. Remote `supabase_migrations` statement-level history (beyond version+name)
  not available via MCP; CLI ledger is version-only.

None of the four blocks the recommendation: every remote object the seven
files promise exists, no extra G1 object exists, zero user rows.

## 5. Reconciliation recommendation

- Do NOT touch the remote ledger merely to make CLI status clean.
- Do NOT mark anything applied in this phase (no authorization recorded
  for repair; constraint prohibits repair).
- After stage-3/4 authorization (named applier, target ref recorded):
  1. Optional read-only close-out: `pg_indexes`, `role_table_grants`,
     `pg_get_functiondef(update_player_handle)` via `execute_sql` SELECT.
  2. Forward-only `migration repair --status applied` for exactly the 7
     local G1 versions (`…03 …04 …05 …06 …07 …08 …09` in local stamps).
  3. `migration list` must show all 7 flipped local↔remote before any push.
- `supabase db push` can operate safely only AFTER that repair: without it,
  push replays `CREATE TABLE app_users` etc. against live objects and fails
  (P13-A §8). After repair, push scope is exactly D1 01–04, P9 05–06,
  P11 01–03, P13 04–05 — all genuinely new objects (verified absent
  remotely: no `platform_admins`, `organizers`, `tournaments`, queue tables).
- No reset, no remote DDL, no repair executed in P13-B (this doc is the
  evidence; `05-migration-application-plan.md` remains the unexecuted plan).
