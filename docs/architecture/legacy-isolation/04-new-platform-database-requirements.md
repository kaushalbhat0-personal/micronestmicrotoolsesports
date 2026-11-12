# 04 — New-Platform Database Requirements Matrix (P14-C1)

Status: **Implemented and statically verified** (source + migration + live-DB SELECT-only reads).
Live project: `knniommcyyhbyiwljisk` (`micronestmicrotoolsesports`, `ap-northeast-1`, PG 17.6.1.171).
No DDL/DML/storage mutation executed.

Conventions: `REQ` = required for first launch · `DEF` = deferred (do not create for launch) ·
`LEG` = legacy-only (never create) · `LOCAL` = local proposal, not yet applied remotely.

## 1. Enums and custom types

| Object | Purpose | Feature | Source/contract | Deps | Security | Launch | Legacy | Verify |
|---|---|---|---|---|---|---|---|---|
| *(none — check-constrained `text` used)* | Avoid enum-migration friction | all | `*.sql` CHECKs; `domain/*.ts` vocabularies | — | App-side Zod revalidates | REQ (as CHECKs) | LEG none | `pg_constraint` SELECT + unit tests |

Decision: keep `text + CHECK + Zod` (roles, lifecycle, trust_state, region, game keys).
Do not introduce PG enums for launch — they complicate the clean rebuild.

## 2. Tables and columns

### Required foundation (exists remotely OR required for launch rebuild)

| Table | Purpose | Feature | Source | Deps | Security | Launch | Verify |
|---|---|---|---|---|---|---|---|
| `app_users` (`id uuid PK/FK auth.users`, `status active|suspended`, `suspended_at/at_reason`, `created/updated_at`) | Identity anchor 1:1 `auth.users` | player-profile/G1-1 | `20261110000003` + `src/features/player-profile/domain/app-user.ts` + `server/ensure-app-user.ts` | `auth.users` | RLS, owner-only, `ensure_app_user` bootstrap | REQ | remote 0 rows, RLS on |
| `player_profiles` (`user_id PK/FK app_users`, `handle 3-20 lower`, `display_name 1-40`, `avatar_path regex`, `bio ≤280`, `country_code CHAR(2) ISO`, `is_discoverable bool default false`, `handle_changed_at`, timestamps) | Canonical profile 1:1 | G1-2/G1-7 | `20261110000005` + `...08` + `domain/player-profile.ts` | `app_users` | Owner RLS + column-grant narrowing (see §10/11) | REQ | remote 0 rows |
| `games` (`key 2-24 slug PK`, `name`, `short_name`, `is_active`, `created_at`) | Catalogue; adding title = INSERT | G1-3 | `20261110000006` + `lib/game-catalog/catalog.ts` | — | Public SELECT, writes migration/service-role only | REQ + seed `bgmi` | remote 1 row `bgmi` active |
| `player_game_profiles` (`id uuid gen_random_uuid PK`, `player_user_id FK`, `game_key FK`, `ign 2-30`, `game_user_id text nullable`, `primary_role IGL/Assaulter/Support/Scout`, `play_modes text[] ≤5`, `region_code india/asia/.../online`, `availability text[] ≤7`, `is_visible bool`, timestamps) | Per-(player,game) self-declared profile | G1-3 | `20261110000006` + `domain/game-profile.ts` | `player_profiles`, `games` | Owner RLS; `game_user_id` omitted from public projection | REQ | remote 0 rows |

### Deferred (LOCAL proposals — do NOT include in first-launch rebuild until owner approval)

| Table | Purpose | Feature | Source | Launch |
|---|---|---|---|---|
| `platform_admins`, `admin_audit_logs`, `cron_run_ledger` | Admin/audit/cron ledger (D1 design pending) | admin | `20261112000001` + `src/server/admin/audit.ts` (pure, no DB) | DEF — no admin writes approved |
| `teams`, `team_members`, `recruitment_posts`, `applications`, `reports` | Teams discovery + workspace | teams P1/P2 | `20261112000002` + `features/teams/server/workspace.ts` | DEF — RPCs `search_teams/get_team_by_slug` unapplied; routes show unavailable/validation-only |
| `organizers`, `organizer_members`, `tournaments` | Organizer registry + tournament link | organizers/tournaments P9 | `20261112000005/06` + readers | DEF — masked RPCs unapplied |
| `moderation_reports`, `verification_cases`, `moderation_decisions` | Moderation queue minimum-viable | moderation P11 | `20261113000003` + `...05` policies | DEF — workspace shells disabled, no queue reads |
| `tournaments` additions (`review_snapshot`, hash cols) | F02 snapshot integrity | P13 | `20261113000004` | DEF — validator pure, no persistence approved |
| `brands`, `organizations`, `articles`/`news` tables | Brand/org/news discovery | P8/P4 | Readers reference PROPOSED RPCs (`search_brands`, `search_organizations`, `search_articles`); **no migration exists** | DEF — do not invent DDL; fail-closed unavailable state is correct |

### Legacy-only / local-only (never create)

| Object | Disposition |
|---|---|
| All 58 `ref/legacy-project/supabase/migrations/*` tables | LEG — never port; greenfield lineage only |
| `src/features/tools/*` persistence | NONE — tools are stateless calculators; no table assumption (verified: zero `.from(` in tools domain) |

## 3. Primary keys and foreign keys

| Constraint | Tables | Source | Launch |
|---|---|---|---|
| `app_users_pkey (id)`, FK `app_users.id → auth.users.id` | anchor | `...03` | REQ |
| `player_profiles_pkey (user_id)`, FK → `app_users(id) ON DELETE CASCADE` | profile | `...05` | REQ |
| `games_pkey (key)` | catalogue | `...06` | REQ |
| `player_game_profiles_pkey (id)`, FKs → `player_profiles(user_id) CASCADE`, `games(key)` | game profile | `...06` | REQ |
| D1/P9/P11 PK/FKs (`teams_pkey`, `team_members (team_id,user_id)`, `recruitment_posts`, `applications`, `organizer_members (organizer_id,user_id)`, `tournaments`) | deferred domains | `...D1/P9/P11` | DEF |

## 4. Unique constraints

| Constraint | Purpose | Launch | Verify |
|---|---|---|---|
| `player_profiles_handle_lower_uniq (lower(handle))` | Case-insensitive handle uniqueness, 404-oracle safe | REQ (remote present) | `pg_indexes` |
| `player_game_profiles_player_user_id_game_key_key` | One row per (player,game) | REQ | remote present |
| `applications_active_unique`, `moderation_reports_open_entity_uidx`, `verification_cases_open_organizer_uidx`, `teams slug`, `organizers slug`, `tournaments slug` | Deferred domains | DEF | local migration static check |

## 5. Check constraints

G1 (REQ): `handle ~ ^[a-z0-9_]{3,20}$`, `display_name 1-40`, `avatar_path regex uuid/avatar.(png|jpg|webp)`,
`bio ≤280`, `country_code ISO list`, `game key slug`, `ign 2-30`, `game_user_id 4-32 text`,
`primary_role` vocab, `play_modes ⊆ {squad,duo,solo,tpp,fpp} ≤5`, `region_code` vocab (ONLINE allowed only here),
`availability ≤7`, `status ∈ {active,suspended}`, `ends_at>starts_at` (tournaments DEF).
All mirrored in Zod (`schemas/*.ts`) + unit tests (1012 pass). Deferred domains add slug/lifecycle/money/URL CHECKs — DEF.

## 6. Indexes

| Index | Launch | Remote | Notes |
|---|---|---|---|
| `player_profiles_handle_lower_uniq`, `player_profiles_discoverable_idx (partial is_discoverable)`, `player_game_profiles_directory_idx (game_key,region,role WHERE is_visible)`, `play_modes/availability GIN` | REQ | Present (4 unused-index INFO lints are expected at 0 rows) | Keep; `auth_rls_initplan` WARN → wrap `auth.uid()` in `(select auth.uid())` in clean chain (perf, no behavior change) |
| D1 insert-boundary (`team_members_user_id`, `recruitment_posts_team_status`, `applications_post/applicant`, `reports_reporter/target`), P9 (`organizers_game_keys GIN`, `region/type/lifecycle/organizer`) | DEF | Absent | Include only when domain approved |

## 7. Functions and RPCs

| Function | Sec | Args | Purpose | Launch | Remote |
|---|---|---|---|---|---|
| `handle_updated_at()` | invoker | — | `updated_at` trigger | REQ | present |
| `ensure_app_user()` | invoker, auth-only | — | Lazy 1:1 bootstrap, session-derived | REQ | present |
| `create_player_profile(p_handle,text,display,bio,country)` | invoker, auth-only | validated | Same-txn profile creation | REQ | present |
| `search_player_directory(p_game,region,role,query,limit,offset)` | DEFINER, anon+auth | masked 8-col | Sole public directory path (D-G1-03) | REQ | present (anon DEFINER lint is intentional — masked projection, no base-table grant) |
| `get_player_by_handle(p_handle)` | DEFINER, anon+auth | masked detail | Sole public profile path | REQ | present (same justification) |
| `set_player_discoverability(p_value)` | DEFINER, auth-only | consent master | Dedicated consent action | REQ | present |
| `update_player_handle(p_handle)` | DEFINER, auth-only | cooldown-guarded | Dedicated handle change (42702 fix applied) | REQ | present |
| `is_super_admin/is_team_member/is_team_captain/search_teams/get_team_by_slug/search_organizers/get_organizer_by_slug/search_tournaments/get_tournament_by_slug/tournament_content_hash/review_approval_valid/provision_organizer/*_guard/freeze_*` | mixed | — | Deferred domains | DEF | absent (local only) |
| `search_brands/get_brand_by_slug/search_organizations/get_organization_by_slug/search_articles/get_article_by_slug` | — | PROPOSED contracts | Readers fail-closed until migration exists | DEF (do not stub) | absent by design |

Linter note: `anon/authenticated SECURITY DEFINER` WARNs on the 2 directory RPCs are **accepted by design**
(masked RPC is the RLS boundary; base tables grant nothing to anon). Document in clean chain header.

## 8. Triggers

REQ: `trg_app_users/player_profiles/player_game_profiles_updated_at → handle_updated_at()`.
DEF: teams/organizer/tournament lifecycle + immutability + trust-guard + published-freeze + moderation no-mutation
(`20261112*-20261113*`). No trigger may write PII to logs.

## 9. RLS enablement

All public tables `ENABLE ROW LEVEL SECURITY`, `FORCE` off (verified `pg_class`).
REQ 4 tables on; DEF tables on in their own migrations (default-deny before policies land).

## 10. RLS policies

REQ (12 remote, verified `pg_policies`): `app_users owner select/insert`, `games public select (true)`,
`player_profiles/player_game_profiles owner select/insert/update/delete` (delete added G1-7,
updates narrowed to column lists). No anon policy on private tables; public reads only via masked RPCs.
DEF: D1/P9/P11 policies (member/captain/moderator-gated, no anon, no DELETE on history) — include only with domain.

## 11. Grants and revokes

REQ pattern (verified `role_table_grants`): `REVOKE ALL FROM public/anon` on private tables/functions;
`GRANT select/insert/update[/delete] TO authenticated` (narrowed: `player_profiles` no direct `UPDATE` —
column grants `display_name,bio,country_code,avatar_path`; `player_game_profiles` column grants for game fields);
`GRANT SELECT ON games TO anon,authenticated`; `GRANT EXECUTE` on directory RPCs to `anon,authenticated`,
on mutators to `authenticated` only; `REVOKE ALL ON ..._updated_at/handle FROM public/anon/authenticated`.
DEF: same default-deny + narrow grants per domain. Never grant `service_role` in request paths; never grant anon on base private tables.

## 12. Storage buckets

| Bucket | Public | Limit | Mimes | Launch | Remote objects |
|---|---|---|---|---|---|
| `public-avatars` | true | 512KiB | png/jpeg/webp | REQ | 0 |
| `public-entity-media` | true | 2MiB | png/jpeg/webp/svg | REQ (future logos/hero; no rows yet) | 0 |
| `private-verification` | false | 5MiB | png/jpeg/webp/pdf | REQ schema, DEF use (unapproved uploads stay disabled app-side) | 0 |

Defined in `20261110000002_storage_foundation` (idempotent `INSERT ... ON CONFLICT DO NOTHING`).

## 13. Storage policies

8 policies verified (`pg_policies schemaname=storage`):
`public-avatars public read (public)`, `owner insert/update/delete (auth.uid() = foldername[1])`;
`public-entity-media public read`; `private-verification owner insert/read/delete-own-pending`.
No anon write; no cross-user read. Keep verbatim in clean chain.

## 14. Seed / reference data

- `seed.sql`: intentionally empty (3 lines). No launch user/business data to preserve
  (`auth.users 0`, `app_users 0`, `storage.objects 0` — verified).
- Migration seed: `games bgmi` (`Battlegrounds Mobile India`, active) idempotent in `...06`
  (`INSERT ... ON CONFLICT (key) DO UPDATE`). Only seed row required. MLBB stays `PLANNED` in
  `lib/game-catalog` (no DB row until approved).

## 15. Extensions

Required: `pgcrypto` (1.3, `gen_random_uuid`), `plpgsql`, `uuid-ossp`, `pg_stat_statements`, `supabase_vault`
(verified `pg_extension`). `pg_trgm` recommended for future directory search (not yet required;
add when org/brand/news domains land). No `postgis/pgcron/pgnet` for launch.

## 16. Views

None required. No views remotely (`information_schema.views` 0) or locally. Do not add views for launch;
masked RPCs are the public projection (avoids anon base-table grants).

## 17. Scheduled jobs / external dependencies

None required. No `cron.job` (`count 0`), no edge functions (`list_edge_functions` empty per design),
no webhooks, no billing/entitlement calls. `cron_run_ledger` table is DEF (D1 pending, no scheduler).
External deps for launch: Supabase Auth (email, `enable_confirmations=false` local) + PostgREST RPC only.

---

### Required vs deferred summary

- **REQUIRED foundation (first launch)**: §2 foundation 4 tables + §3-11 G1 objects + §12-13 3 buckets/8 policies + §14 `bgmi` seed + §15 5 extensions. All exist remotely (9 migrations) and are exercised by `player-profile` server ops + 1012 unit tests.
- **DEFERRED (do not create)**: D1 admin/teams, P9 organizers/tournaments, P10/P11 moderation, P13 snapshots/activation, P8 brands/organizations, P4 news, mini-games, verification uploads, recruitment/billing transactions, brackets/live scoring/payments/prize distribution. Readers already fail-closed; creating tables early would widen attack surface without approved writes.
- **LEGACY-ONLY**: anything under `ref/legacy-project/supabase/` — never port.
- **LOCAL-ONLY tools**: `prize-pool/roster/tiebreak` — no DB objects by design.
