# 09 — Fresh Database Execution (P14-C2)

Status: **Executed to the extent supported. Reset NOT performed (no supported non-Docker
remote reset exists); remote already in the approved clean-foundation state, verified read-only.**
No secrets included. No commit/push/deploy/legacy-deletion.

## 1. Project identity and health (verified via MCP `get_project`, 2026-11-12)

- Ref: `knniommcyyhbyiwljisk` ✓ (matches authorization; never touched `iwgefthgciddukqabkun`)
- Name: `micronestmicrotoolsesports` ✓ · Org `ocibmbassdueawosaagi` ✓
- Region: `ap-northeast-1` ✓ · Status: `ACTIVE_HEALTHY` ✓
- PG: `17.6.1.171`, engine 17 ✓ · Local link: `supabase/.temp/project-ref` +
  `linked-project.json` → `knniommcyyhbyiwljisk` ✓
- CLI: `2.109.1` (`npx supabase --version` + `supabase --version` agree)

## 2. Pre-reset inventory (read-only SELECT + MCP list calls)

- Ledger (`list_migrations`): 9 applied —
  `20261110000001`/`...02` (match local versions exactly),
  `20261110135602`/`...135654`/`...141108`/`...143759`/`20261111072251`/`...090645`/`...091947`
  (dashboard-applied stamps; content = local G1 files `...03`–`...09`, names match).
- Tables (`list_tables verbose`): 4, all RLS on —
  `app_users 0 rows`, `player_profiles 0`, `games 1 (bgmi active)`, `player_game_profiles 0`.
- Auth: `auth.users 0`. Storage: 3 buckets
  (`public-avatars` public 512KiB, `public-entity-media` public 2MiB,
  `private-verification` private 5MiB), `storage.objects 0` across all buckets.
- Functions: 7 (`ensure_app_user`, `create_player_profile`, `search_player_directory`,
  `get_player_by_handle`, `set_player_discoverability`, `update_player_handle`, `handle_updated_at`).
- Policies: 12 public + 8 storage. Indexes: 10. Triggers: 3 (`*_updated_at`).
- Extensions: `pgcrypto 1.3`, `plpgsql`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`.
  Views: 0. Cron: 0. Edge functions: none by design.
- Advisors: security WARNs = 2 anon-DEFINER (directory RPCs, intentional masked projection)
  + 4 auth-DEFINER (expected); performance: 10 `auth_rls_initplan` (fix: `(select auth.uid())`
  in future chain), 4 unused-index INFO at 0 rows.
- Matches P14-C1 runbook inventory exactly — zero launch users/objects to preserve.

## 3. Reset mechanism and exact operation used

Investigated before any mutation:

- `supabase db --help`: `reset` = “Resets the **local** database to current migrations”
  (local-only; requires Docker). No remote-reset subcommand exists in CLI 2.109.1.
- `supabase migration --help`: `up/down/repair/fetch` are local/history-table ops; no remote reset.
- MCP catalog (36 tools enumerated): no remote-DB reset tool. Closest —
  `reset_branch` (preview branches only, not production), `apply_migration` (DDL apply, not reset),
  `execute_sql` (raw SQL; handcrafted DROP-as-reset explicitly forbidden by task §10/§3).
- Docker is forbidden in this environment, so even local-reset validation is unavailable.

**Operation used: NONE (no reset command issued).** Per task §3:
“Stop before mutation. Report the exact limitation. … Do not simulate a successful reset.”

Supported alternatives for a future window: Supabase dashboard Database reset,
or CI with Docker running `supabase db reset --linked`, followed by `db push --linked`.
Additionally unnecessary here (see §4): remote already equals the approved foundation.

## 4. Reset result

**Reset did NOT complete — deliberately not attempted** (see §3).
No destructive command was issued; nothing was destroyed because nothing needed destroying
(pre-reset counts already 0/0/1/0 + 0 auth users + 0 objects).

## 5. Seven migration filenames and SHA-256 (reconciliation)

The documented `20261115*` 7-file consolidation **does not exist on disk** — investigated
per task §2 before touching the database. Actual materialized chain covering the identical
approved scope (G1 foundation) is 9 physical files (03/04 split identity+grant-tightening;
08/09 split lifecycle+handle-fix):

| File on disk = approved scope | SHA-256 |
|---|---|
| `20261110000001_foundation_baseline.sql` | `8F1A6C1C…B63C4B` |
| `20261110000002_storage_foundation.sql` | `44EAA601…B90BBD` |
| `20261110000003_g1_identity_anchor.sql` | `4C34D4BE…FB389` |
| `20261110000004_g1_identity_anchor_grant_tightening.sql` | `1CB87525…E24351A` |
| `20261110000005_g1_player_profile.sql` | `A07269A1…144C85` |
| `20261110000006_g1_game_catalogue.sql` | `43A7FD92…8CBC871` |
| `20261110000007_g1_public_projection.sql` | `8F093298…B6258DC` |
| `20261111000008_g1_owner_settings_lifecycle.sql` | `3A408833…D70606` |
| `20261111000009_g1_handle_function_fix.sql` | `8ACFE5C1…CBB392` |

(Full hashes in Stage A shell log; prefixes above, complete values recorded in repo shell history.)
Timestamps unique + strictly ordered ✓. No legacy migration included ✓
(legacy 58 live only at `ref/legacy-project/supabase/`).
No destructive ops against unrelated schemas ✓ (`grep` DDL: no `DROP DATABASE/SCHEMA`,
no `COPY FROM`, seeds idempotent `ON CONFLICT`).
Deferred 11 (D1/P9/P11/P13) + 58 legacy explicitly excluded — NOT applied, NOT repaired, NOT pulled.

`supabase migration list` explains the version-string drift: local `...03–09` vs remote
`...135602–...091947` (same content, dashboard stamps). `db push --linked --dry-run`
**fails** (exit 1) asking for `migration repair … reverted` — repair is forbidden, so
push was NOT attempted. Remote schema inspection (§8) proves content parity regardless of stamps.

## 6. Individual migration results

**Zero migrations applied — none needed, none attempted.**

- Foundation 9/9 content already present remotely (schema §8 byte-for-byte matches local DDL intent).
- `db push --dry-run`: exit 1, would-be divergence is ledger-stamp-only, not schema drift.
- Deferred 11: NOT applied per scope boundary (teams/orgs/brands/tournaments/organizers/news/
  moderation/billing/mini-games/tournament-ops remain excluded; routes fail-closed by design).
- Legacy 58: NOT applied. No skip, no blind repair, no `db pull` overwrite of worktree.

## 7. Seed results

No seed command run (nothing to seed — remote already seeded correctly):

- `games`: 1 row `bgmi | Battlegrounds Mobile India | active=true` ✓ (idempotent migration seed).
- `seed.sql` (3 lines, intentionally empty) correctly NOT applied beyond migrations — no local seed push.
- No fabricated users/profiles/objects (counts §2/§8).

## 8. Post-reset schema inventory (remote SELECT-verified, not assumed)

- Columns (42 across 4 tables): `app_users` 6, `games` 5, `player_game_profiles` 12
  (`id gen_random_uuid`, `player_user_id`, `game_key`, `ign`, `game_user_id nullable`,
  `primary_role`, `play_modes[]`, `region_code`, `availability[]`, `is_visible`,
  timestamps), `player_profiles` 10 incl. `handle_changed_at`. Full dump in verification log.
- PKs: `app_users(id)`, `games(key)`, `player_game_profiles(id)`, `player_profiles(user_id)`.
  FKs: `app_users.id→auth.users`, `player_profiles→app_users CASCADE`,
  `game_profiles→player_profiles CASCADE + →games`.
- Uniques: `player_profiles_handle_lower_uniq`, `player_game_profiles(player_user_id,game_key)`.
- Indexes (10): PKs + `discoverable_idx` partial + `directory_idx` partial + GIN `play_modes`/`availability`.
- Triggers (3): `trg_*_updated_at → handle_updated_at()`.
- Extensions installed: `pgcrypto`, `plpgsql`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`.
- Views 0, cron jobs 0, deferred tables 0 (correctly absent).

## 9. RLS and policy verification

- RLS enabled on all 4 tables (`pg_class relrowsecurity=true`), `FORCE` off.
- Public policies (12): `app_users owner select/insert`; `games public select (true)`;
  `player_profiles/player_game_profiles owner select/insert/update/delete`
  (G1-7 deletes + column-narrowed updates verified in grants).
- Storage policies (8): `public-avatars public read + owner insert/update/delete-own`,
  `public-entity-media public read`, `private-verification owner insert/read/delete-own-pending`.
- Grants: `REVOKE ALL FROM public/anon` on private tables/functions; `authenticated` least-privilege;
  `anon+authenticated SELECT ON games`; `EXECUTE` directory RPCs → anon+auth, mutators → auth-only.
  No anon base-table access on private data. No `service_role` in request paths (code scan §13).
- Advisor posture unchanged and accepted: anon-DEFINER ×2 intentional (masked RPC = RLS boundary,
  base tables grant anon nothing); auth-DEFINER ×4 expected session-guarded mutators.

## 10. Function and trigger verification

- 7/7 present with exact signatures: `handle_updated_at()`, `ensure_app_user()`,
  `create_player_profile(text×4)`, `search_player_directory(text×4,int×2)`,
  `get_player_by_handle(text)`, `set_player_discoverability(bool)`, `update_player_handle(text)`.
- `SECURITY DEFINER` review: directory pair (anon-executable by design, empty `search_path`,
  masked 8/12-col projection, no `game_user_id`/PII leak); mutators auth-only + session-derived
  (`auth.uid()`, never caller-supplied IDs); no user-controlled identity params; no privilege-escalation
  path (owner + active-account guards in policies + writers).
- `search_path`: DEFINER RPCs set empty per migration source (static source audit; runtime
  `search_path` probe not run — noted as follow-up with DBA).

## 11. Storage verification (separate from DB reset — verified, not assumed)

- Buckets (3): `public-avatars` public/512KiB png-jpeg-webp ✓, `public-entity-media`
  public/2MiB +svg ✓, `private-verification` private/5MiB +pdf ✓.
- Policies (8) as §9 ✓. Objects: 0 in every bucket ✓ (`GROUP BY bucket_id` empty set).
- Reset would NOT reliably clear objects — moot (already empty); no storage deletion performed.

## 12. Generated TypeScript type result

- `supabase gen types typescript --linked -s public` (remote, Docker-free — the supported
  non-Docker equivalent of `npm run db:types --local`): exit 0.
- Wrote `src/types/database.ts` (UTF-8, 411 lines; fixed PowerShell UTF-16 redirect to UTF-8
  without BOM): placeholder `Record<string,never>` → full `Database` (4 Tables with
  Row/Insert/Update + FK Relationships, 6 Functions with Args/Returns, 0 Views/Enums).
  Verified tables/funcs present (`grep`: `app_users`, `player_profiles`,
  `player_game_profiles`, `search_player_directory`, `ensure_app_user`).
- Diff: 408 insertions / 10 deletions, single file — the only source change this phase (Stage F authorized).
- `npm run typecheck` AFTER regen: PASS (proves generated types integrate).

## 13. Application test results (all with regenerated types)

- `npm run typecheck`: PASS · `npm run lint`: PASS (exit 0 both).
- `npm test` (unit, excl. integration): **99 files / 1012 tests PASS**.
- `npm run build` (Turbopack): PASS — 16/16 static pages, 36 routes listed.
- Contract tests (fake-client, no DB): directory readers, writer-gate `*_WRITES_ENABLED=false`,
  security boundaries all green within the 1012.
- Read-only integration: RPC smoke as anon NOT executed via MCP (would run elevated, not a true
  anon proof) — deferred to manual QA with anon key; no test user created, no account data touched.
- Write switches verified OFF (`grep`): `ORGANIZER/TOURNAMENT/MODERATION/NEWS/WORKSPACE_WRITES_ENABLED`
  all `false`; workspace actions return `*_DISABLED_MESSAGE`; deferred features NOT activated.

## 14. Git status and worktree preservation

- Branch `new-platform` @ `376df8f`. Pre-existing: 9 modified + 731 untracked (incl. 18 untracked
  migration files) — ALL preserved; no stash/reset/checkout/overwrite.
- Phase changes: **1 modified** (`src/types/database.ts`, Stage F authorized) + **1 created**
  (`docs/architecture/legacy-isolation/09-fresh-database-execution.md`, this file).
- No commit, no push, no deploy (verified `git status --short`; only the two entries above are new
  versus P14-C1 baseline). No legacy deletion, no repo-wide cleanup, no unrelated source edits.

## 15. Blockers and deviations

1. **BLOCKER (reset): no supported non-Docker remote reset exists** — `db reset` is local-only +
   Docker-gated; MCP has no remote-reset tool; DROP-substitute forbidden. Reset NOT executed.
   Mitigation: remote already equals approved foundation (§2/§8), so reset is unnecessary as well
   as unavailable. Future window: dashboard reset or Docker-CI `db reset --linked`.
2. **Deviation (chain shape): documented `20261115*` 7-file consolidation never materialized.**
   Reconciled: 9 on-disk G1 files = same 7 logical steps (grant-tightening + handle-fix splits).
   No new files invented (would violate “do not silently rewrite history”).
3. **Ledger drift (informational):** dashboard stamps differ from local versions; `db push --dry-run`
   exits 1 requesting forbidden `repair`. Left untouched; schema content verified authoritative instead.
4. **Follow-ups (non-blocking):** live anon-RPC smoke with anon key; DBA `search_path` runtime probe;
   `(select auth.uid())` perf wrap in next chain revision; `auth.users` untouched-verification at reset time.

Machine-readable manifest: this repo has no established manifest convention (no `manifests/` dir,
no JSON manifest in prior evidence reports); the SHA table in §5 + `migration list` JSON log above
serve as the verification manifest. No new convention invented.
