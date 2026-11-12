# 05 — Clean Migration Plan (P14-C1)

Status: **Proposed** (ordered plan for an empty PG17 DB; nothing applied/repaired in this phase).
Do not modify/delete existing files; do not run `db push/reset/repair` until separately authorized.

## 1. Principles

- Greenfield lineage only. Historical `ref/legacy-project/supabase/` (58 files) is never authority.
- One migration = one dependency boundary (table + RLS + policies + grants + triggers + RPCs together).
- `ENABLE ROW LEVEL SECURITY` + default-deny `REVOKE` in the same file as the table — never a later fix-up.
- Masked `SECURITY DEFINER` RPCs are the sole anon path; base private tables grant nothing to anon.
- Idempotent seeds (`ON CONFLICT DO NOTHING/DO UPDATE`); no `COPY FROM`, no server-file reads.
- Every file states linter expectations (`anon DEFINER` intentional; `auth_rls_initplan` avoided via `(select auth.uid())`).

## 2. Proposed ordered chain (fresh `supabase/migrations/`)

Use new timestamp prefix (e.g. `20261115000001_*`) to avoid collision with dashboard-applied stamps.
Retain current 9 G1 files’ SQL as source, but re-emit as the clean sequence below (copy, don’t edit history).

| # | Filename (proposed) | Purpose / objects | Deps | RLS/security | Idempotency | Tests | Rollback |
|---|---|---|---|---|---|---|---|
| 01 | `20261115000001_foundation.sql` | `pgcrypto` extension guard, `handle_updated_at()`, `search_path`, usage grants | extensions | Revoke `handle_updated_at` from public/anon/auth | `CREATE OR REPLACE`, `CREATE EXTENSION IF NOT EXISTS` | `audit.test.ts`, migration static `grep create function` | Drop function (no data) |
| 02 | `20261115000002_storage.sql` | Buckets `public-avatars/public-entity-media/private-verification` + 8 storage policies | — | Foldername-`auth.uid()` + public-read only | `INSERT ... ON CONFLICT DO NOTHING` | Avatar integration (deferred lane) + storage policy SELECT | Delete policies then buckets (only when 0 objects — verified 0) |
| 03 | `20261115000003_identity.sql` | `app_users` + `ensure_app_user()` + owner RLS + narrow grants + updated_at trigger | 01, `auth.users` | Owner-only; `(select auth.uid())`; revoke anon | `CREATE TABLE IF NOT EXISTS` + `OR REPLACE` function | `ensure-app-user.test.ts` + integration (linked) | `DROP TABLE app_users CASCADE` (destroys profiles — reset only) |
| 04 | `20261115000004_profiles.sql` | `player_profiles` + `create_player_profile()` + handle-unique/discoverable indexes + owner RLS + trigger | 03 | Owner-only; no anon; revoke update-then-column-grant | `IF NOT EXISTS` / `OR REPLACE` | `player-profile.test.ts`, `handle-ops`, `directory-reader.test.ts` | Drop table (cascade game profiles) |
| 05 | `20261115000005_catalog.sql` | `games` + `player_game_profiles` + GIN/btree indexes + `games public select` + owner RLS + trigger | 04 | `games` SELECT anon+auth; game profiles owner-only; `game_user_id` never in RPC output | Seed `bgmi ON CONFLICT DO UPDATE` | `game-profile-ops`, `catalog.test.ts` | Delete game rows only when no profiles |
| 06 | `20261115000006_directory.sql` | `search_player_directory` + `get_player_by_handle` (DEFINER, empty `search_path`) + execute grants | 03-05 | Revoke public; grant anon+auth; document intentional anon-DEFINER lint | `OR REPLACE` | `directory-reader.test.ts` + `search_player_directory` contract tests | `REVOKE EXECUTE`, drop functions |
| 07 | `20261115000007_settings.sql` | Owner deletes + column-narrowed updates + `set_player_discoverability` + `update_player_handle` (cooldown) | 03-06 | Auth-only executes; `(select auth.uid())`; active-account guard | `OR REPLACE` + `DO $$` backfill `handle_changed_at` null-safe | `consent-ops`, `handle-ops`, `deletion-ops`, `completeness.test.ts` | Revoke column grants (no data loss) |

Total: 7 files for first launch. Nothing else.

## 3. Explicitly excluded (deferred to owner-approved follow-ups)

| Excluded local file(s) | Reason |
|---|---|
| `20261112000001_d1_admin_foundation` + `...03` remediation excerpts | Admin/audit design pending; no approved writers |
| `20261112000002/03/04_d1_*` | Teams discovery unapplied; routes validation-only by design |
| `20261112000005/06_p9_*` | Organizer/tournament masked RPCs unapplied; keep fail-closed |
| `20261113000001/02_p11_*`, `...03/05` moderation parts | Trust/published guards + queue require activation approvals (D-01…D-14) |
| `20261113000004_p13_f02_snapshot` + `...05` activation | Snapshot/activation pending P12/P13 owner gates |
| Brand/org/article DDL | No proposal accepted — do not invent tables; RPC-not-found → unavailable is correct |

Archive path for deferred work: keep current files untouched under `supabase/migrations/` until
the clean chain is authorized, then move superseded proposals to `legacy/database/proposals/`
(or delete if re-authored). Never silently rewrite them.

## 4. Migration-directory disposition

- **Retain**: the 9 G1 files as source for the clean chain (read-only reference until cutover).
- **Replace**: re-emit as `20261115*` clean 7-file chain on an empty DB (avoids dashboard-stamp drift:
  remote `20261110135602` vs local `20261110000003` naming).
- **Archive**: 11 D1/P9/P11/P13 files → `legacy/database/proposals/` after owner sign-off (keeps lineage auditable).
- **Exclude**: 58 legacy migrations — remain at `ref/legacy-project/supabase/` (future `legacy/database/legacy-reference/` pointer only).
- **Stamps**: dashboard-applied stamps are informational; clean rebuild does not repair them
  (reset creates a fresh ledger — see `06`).

## 5. RLS/security plan (per-migration checklist)

Each migration must: `ENABLE ROW LEVEL SECURITY`; `REVOKE ALL FROM public/anon[/authenticated]` before grants;
least-privilege `GRANT` (column-level where relevant); `(select auth.uid())` in policies;
`SECURITY DEFINER ... SET search_path = ''` for masked RPCs; `REVOKE EXECUTE FROM public` then narrow grant;
no `service_role` in policies; no anon base-table access on private data. CI gate:
`grep -r "service_role" supabase/migrations` (expect 0) + advisor re-run (expect only intentional anon-DEFINER).

## 6. Test and recovery approach

- **Static**: `grep` object inventory (§2 table), `supabase db lint`-equivalent advisor review,
  `tsc`, `eslint`, `vitest` (1012 unit, fake clients), route-guard tests (no `.from(`).
- **Local (non-Docker note)**: Supabase CLI local stack requires Docker (unavailable per constraints).
  Use hosted-branch or CI-linked validation instead — do not claim local `db reset` without Docker.
- **Post-apply (future authorized run)**: `list_tables verbose`, `pg_policies`, `role_table_grants`,
  `storage.buckets`, advisor `security/performance`, `games` seed check, RPC smoke
  (`search_player_directory` limit 1 as anon → 0 rows, no error leak), app integration
  (`/players` renders unavailable-not-crash when 0 rows; `/settings/profile` requires auth).
- **Rollback**: within a single migration use transaction (`BEGIN/COMMIT` per file is CLI default);
  cross-migration rollback = full reset (no partial downgrade scripts for launch chain).
  Data loss scope is zero (0 launch users/objects verified) — see `06 §destruction`.
