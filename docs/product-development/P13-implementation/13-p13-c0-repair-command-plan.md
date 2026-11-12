# 13 — P13-C0 repair command plan (NOT EXECUTED — authorization-gated)

Seven exact mappings reproduced from P13-B document 07 (both passes agree;
content-equivalence evidence re-stated here from the read-only record).
No repair was executed in this phase. The intended operation is forward-only
`migration repair --status applied` for exactly local migrations 03–09,
after separate authorization. Never repair unrelated versions.

## 1. The seven mappings

| # | Remote version | Remote migration name | Local migration filename (local version) | Content/object equivalence evidence (remote SELECT + local read) | Exact proposed repair command | Expected ledger result |
| - | -------------- | --------------------- | ---------------------------------------- | --------------------------------------------------------------- | ----------------------------- | ---------------------- |
| 1 | `20261110135602` | `g1_identity_anchor` | `20261110000003_g1_identity_anchor.sql` (`20261110000003`, 4610 B) | Same intent: `app_users` anchor + `ensure_app_user()` INVOKER + owner select/insert, no anon. Remote: table `app_users`, trigger `trg_app_users_updated_at`, fn `ensure_app_user()` INVOKER, 2 owner policies present. Grant-surface exactness stays an honest residual (file 04 normalizes it). | `npx supabase migration repair --status applied 20261110000003` (as element 1 of the single 7-version command in §2) | Local `20261110000003` flips from local-only to local↔remote matched. No DDL runs; `app_users` untouched. |
| 2 | `20261110135654` | `g1_identity_anchor_grant_tightening` | `20261110000004_g1_identity_anchor_grant_tightening.sql` (`20261110000004`, 748 B) | Same intent: grant-only revoke of UPDATE-family on `app_users`. Remote: no owner-UPDATE path (only select/insert policies); file creates no object so nothing to inventory. Lowest risk of the seven. | `npx supabase migration repair --status applied 20261110000004` (element 2 of §2) | Local `20261110000004` flips to matched. No schema object affected by design. |
| 3 | `20261110141108` | `g1_player_profile` | `20261110000005_g1_player_profile.sql` (`20261110000005`, 10929 B) | Same intent: `player_profiles` + `create_player_profile()` + owner select/insert/update, no delete at this layer. Remote: table, `trg_player_profiles_updated_at`, fn INVOKER, 3 owner policies present (delete arrived in file 08). Index-level confirmation (`pg_indexes`) is an optional read-only follow-up, not a blocker. | `npx supabase migration repair --status applied 20261110000005` (element 3 of §2) | Local `20261110000005` flips to matched. No DDL runs. |
| 4 | `20261110143759` | `g1_game_catalogue` | `20261110000006_g1_game_catalogue.sql` (`20261110000006`, 10314 B) | Same intent: `games` + `bgmi` seed + `player_game_profiles` + owner RLS + public catalogue select. Remote: both tables, `bgmi` seed row, 1 + 3 policies present; correctly no function created here. | `npx supabase migration repair --status applied 20261110000006` (element 4 of §2) | Local `20261110000006` flips to matched. Seed row untouched. |
| 5 | `20261111072251` | `g1_public_projection` | `20261110000007_g1_public_projection.sql` (`20261110000007`, 7958 B) | Same intent: RPC-only public reads, 2 DEFINER fns, anon+authenticated EXECUTE. Remote: `search_player_directory` + `get_player_by_handle` DEFINER present; advisor EXECUTE posture matches the approved design (WARNs are posture notes, not drift). | `npx supabase migration repair --status applied 20261110000007` (element 5 of §2) | Local `20261110000007` flips to matched. RPCs untouched. |
| 6 | `20261111090645` | `g1_owner_settings_lifecycle` | `20261111000008_g1_owner_settings_lifecycle.sql` (`20261111000008`, 9431 B) | Same intent: `handle_changed_at` + 2 owner-DELETE policies + UPDATE tightening + 2 DEFINER settings fns. Remote: column present, 11-policy total matches exactly (7 pre-08 + 2 DELETE + 2 unchanged), `set_player_discoverability` + `update_player_handle` DEFINER present. | `npx supabase migration repair --status applied 20261111000008` (element 6 of §2) | Local `20261111000008` flips to matched. No DDL runs. |
| 7 | `20261111091947` | `g1_handle_function_ambiguity_fix` | `20261111000009_g1_handle_function_fix.sql` (`20261111000009`, 3577 B) | Same intent: one-line row-lock qualification in `update_player_handle` (42702 fix), no behavior change. Remote: fn signature DEFINER present; body-text delta not retrievable via the allowed SELECT inventory — recorded residual, harmless with zero user rows. | `npx supabase migration repair --status applied 20261111000009` (element 7 of §2) | Local `20261111000009` flips to matched. Function body untouched. |

## 2. Exact command (single invocation, exact order)

```powershell
npx supabase migration repair --status applied 20261110000003 20261110000004 20261110000005 20261110000006 20261110000007 20261111000008 20261111000009
```

Followed immediately (read-only) by:

```powershell
npx supabase migration list
```

## 3. Expected `migration list` result after repair

- Local `20261110000001`/`02`: still matched (unchanged).
- Local `20261110000003`–`20261110000007`, `20261111000008`/`09`: flip
  from local-only to matched. REQUIRED: all 7 flip. Otherwise STOP.
- Local `20261112000001`–`20261112000006`, `20261113000001`–`20261113000005`
  (the 11 from doc 12): still local-only, in exact expected order. REQUIRED.
- The 7 remote dashboard stamps (`20261110135602` … `20261111091947`)
  remain in remote history: repair is additive ledger marking, NOT a history
  rewrite — it does not delete or rename the dashboard rows. Their continued
  presence after repair is expected, not drift.

## 4. What repair does and does not do

- DOES: insert ledger rows marking the 7 local versions applied without
  executing their SQL. Mutates the migration ledger only.
- DOES NOT: run any DDL/DML, touch any table, function, policy, trigger,
  grant, or the `bgmi` seed; change data; fix or conceal drift (there is
  none — objects verified present, zero user rows).
- Rollback of a repair, if ever wrongly applied: re-mark the ledger
  (ledger-only, no data change). Still requires its own authorization —
  a wrong repair must be reported, not silently unmarked.

## 5. Stop conditions for the repair step

- Any ref/project mismatch in preflight → do not run.
- Any prompt suggesting reset, destructive SQL, or data change → stop,
  report, do not answer affirmatively.
- Post-repair `migration list` shows anything other than §3 (a version
  that did not flip, a flipped version that should not have, any new
  remote-only version) → STOP, re-preflight, report. Do NOT proceed to push.
- Never add versions to the §2 command (in particular never any
  `20261112…`/`20261113…` version — those must be PUSHED, not marked).
- Never run repair per-version subsets and push in between; the 7 marks
  form one atomic intent verified by a single `migration list`.
