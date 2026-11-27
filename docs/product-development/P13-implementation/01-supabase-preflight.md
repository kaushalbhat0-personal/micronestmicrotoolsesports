# 01 — Supabase preflight (read-only inspection, 2026-11-12)

Method: `git` worktree inspection, `npx supabase projects list`,
`npx supabase migration list`, Supabase MCP `get_project` / `list_migrations` /
`list_tables` / `execute_sql` (SELECT only). No writes of any kind; no
secrets recorded. Sibling project `whitelabel-lms` never accessed.

## 1. Git / worktree

- Branch: `new-platform`; HEAD: `01893ae`; single worktree (repo root).
- Uncommitted changes preserved (66 paths: pre-existing M/?? entries plus
  P10–P13 additions). No commit, push, or deploy performed.

## 2. Project identity (confirmed, matches §2 exactly)

- `projects list` + `get_project`: id/ref `knniommcyyhbyiwljisk`,
  name `micronestmicrotoolsesports`, org `ocib…`, region `ap-northeast-1`,
  status `ACTIVE_HEALTHY`, PG `17.6.1.171` (engine 17, release channel ga),
  created 2026-09-30. Linked: true.

## 3. Migration history

CLI `migration list` (local ↔ remote):

| Local | Remote | Meaning |
| ----- | ------ | ------- |
| 20261110000001/02 | same | baseline + storage — applied both sides |
| 20261110000003–09, 11…08/09, 12…01–04, 13…01–03 | — | local-only, unapplied (G1 content, D1, P9, P11) |
| — | 20261110135602 … 20261111091947 (7) | dashboard-applied G1 migrations, names identical to local 03–09 (`g1_identity_anchor`, `grant_tightening`, `player_profile`, `game_catalogue`, `public_projection`, `owner_settings_lifecycle`, `handle_function_ambiguity_fix`) with different version stamps |

MCP `list_migrations` confirms the same 9 remote versions.

## 4. Remote schema state (read-only)

- `list_tables(public, verbose)`: exactly 4 tables — `app_users` (0 rows),
  `player_profiles` (0), `games` (1 row: bgmi), `player_game_profiles` (0).
  No `platform_admins`, no `organizers`, no `tournaments`, no queue tables.
- `pg_policies`: 11 G1 policies (app_users owner insert/select, games public
  select, profiles/game-profiles owner CRUD). No D1/P9/P11 policies.
- `information_schema.triggers`: 3 `updated_at` triggers (G1). No guard,
  lifecycle, freeze, or audit triggers.
- `pg_proc(public)`: 7 G1 functions (`ensure_app_user`,
  `search_player_directory`, `get_player_by_handle`, `create_player_profile`,
  `set_player_discoverability`, `update_player_handle`,
  `handle_updated_at`). No `is_super_admin`, no organizer/tournament RPCs,
  no P11/P13 functions.
- Row counts: zero user data anywhere; only the `bgmi` catalogue seed.

**Conclusion: remote = G1-complete (through handle fix), zero user rows.**

## 5. Was the database reset?

No reset was performed by this phase, and no reset is needed. The remote-only
versions are explained (dashboard-applied G1 with different stamps, schema
state matches). Whether a reset happened historically cannot be determined
from available metadata — and is irrelevant: current state is clean,
seed-only, and fully characterized.

## 6. P11 files present and intact (sha256, 12-char prefix)

- `20261113000001_p11_f01_trust_guard.sql` — 3689B — `3ae4054c8655`
- `20261113000002_p11_f02_published_integrity.sql` — 4945B — `a39178066d93`
- `20261113000003_p11_moderation_queue.sql` — 7216B — `1ca6e2fd857b`
- P9 pair intact: 05 `b8b747c6e3a1`, 06 `12cc0c8d7448`. No remote migration
  lacks a local counterpart (all 9 remote versions map by name).

## 7. Write switches: all OFF (verified)

`ORGANIZER_WRITES_ENABLED`, `TOURNAMENT_WRITES_ENABLED`,
`MODERATION_WRITES_ENABLED` — all `false`, all test-pinned.

## 8. Discrepancy and recommendation

**Discrepancy:** local G1 files 03–09 will read as "unapplied" (version
mismatch) although their content is live remotely. A blind `db push` would
attempt re-application and fail on existing objects (e.g. `CREATE TABLE
app_users`).

**Recommendation (NOT executed in P13-A):** after content-equivalence is
accepted on the object inventory above (§4), align history forward-only with
`supabase migration repair --status applied` for exactly the 7 local G1
versions, then push only the genuinely-new files (D1 01–04, P9 05–06,
P11 01–03, P13-A 04–05). No reset, no destructive SQL, no repair to conceal
drift — versions map 1:1 by name to live objects. Full command plan in
`05-migration-application-plan.md`. No data loss is possible (zero user rows),
but the seed row and history alignment still require the stage-4
authorization from P12 before any command runs.
