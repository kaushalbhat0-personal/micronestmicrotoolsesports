# 05 — Database and RLS Design (G1, design only — no SQL migrations)

## 1. Proposed tables and columns

### `app_users` (identity anchor)
- `id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE` — equals `auth.uid()`.
- `status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended'))`.
- `suspended_at timestamptz NULL`, `suspension_reason text NULL` (private, never projected; `CHECK ((status='suspended') = (suspended_at IS NOT NULL))` optional).
- `created_at / updated_at timestamptz NOT NULL DEFAULT now()`; `updated_at` via `public.handle_updated_at()` trigger (foundation reuse).
- Indexes: PK only (+ optional partial index `WHERE status='active'` if directory joins filter on it — see projection, which joins via RPC with explicit predicate; partial index helps).

### `player_profiles`
- `user_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE`.
- `handle text NOT NULL CHECK (handle ~ '^[a-z0-9_]{3,20}$')` (stored lowercase; app lowercases before insert).
- `display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40)`.
- `avatar_path text NULL CHECK (avatar_path IS NULL OR avatar_path ~ '^[0-9a-f-]{36}/avatar\.(png|jpe?g|webp)$')` — UIDs are UUIDs; extension allowlisted (no SVG in avatars; see 06).
- `bio text NULL CHECK (bio IS NULL OR char_length(bio) <= 280)`.
- `country_code char(2) NULL CHECK (country_code IS NULL OR country_code IN (<seeded ISO-3166-1 alpha-2 allowlist>))` — APPROVED D-G1-09: ISO alpha-2 only; `ONLINE` is never valid here. Allowlist enumerated in migration comment (keep list small, extend via later migration). Game-specific validation must not be hardcoded into canonical identity.
- `is_discoverable boolean NOT NULL DEFAULT false`.
- `created_at / updated_at timestamptz NOT NULL DEFAULT now()`; trigger `handle_updated_at`.
- Unique: `UNIQUE (lower(handle))` (case-insensitive; functional unique index).
- Indexes: `UNIQUE lower(handle)`; btree `(is_discoverable)` partial `WHERE is_discoverable = true` for directory prefilter (RPC still predicates).

### `games` (catalogue)
- `key text PRIMARY KEY CHECK (key ~ '^[a-z0-9-]{2,24}$')`, `name text NOT NULL`, `short_name text NOT NULL`, `is_active boolean NOT NULL DEFAULT true`, `created_at timestamptz NOT NULL DEFAULT now()`.
- Seed row: `('bgmi','Battlegrounds Mobile India','BGMI',true)`.
- No RLS user writes; `SELECT` public (see §3).

### `player_game_profiles`
- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` (pgcrypto, extensions schema).
- `player_user_id uuid NOT NULL REFERENCES player_profiles(user_id) ON DELETE CASCADE`.
- `game_key text NOT NULL REFERENCES games(key) ON DELETE RESTRICT`.
- `ign text NOT NULL CHECK (char_length(ign) BETWEEN 2 AND 30)`.
- `game_user_id text NULL CHECK (game_user_id IS NULL OR char_length(game_user_id) BETWEEN 4 AND 32)`.
- `primary_role text NULL CHECK (primary_role IS NULL OR primary_role IN ('IGL','Assaulter','Support','Scout'))`.
- `play_modes text[] NOT NULL DEFAULT '{}' CHECK (array_length(play_modes,1) IS NULL OR array_length(play_modes,1) <= 5)` + per-element allowlist enforced in app + DB `CHECK (play_modes <@ ARRAY['squad','duo','solo','tpp','fpp'])`.
- `region_code text NULL CHECK (region_code IS NULL OR region_code IN ('india','asia','europe','north-america','south-america','middle-east','online'))` — APPROVED D-G1-09: BGMI game-specific vocabulary (illustrative). `ONLINE` permitted here only because the BGMI vocabulary includes it. Different games may define different vocabularies; the canonical profile schema does not change when a game is added.
- `availability text[] NOT NULL DEFAULT '{}'` same length cap 7 + allowlist subset.
- `is_visible boolean NOT NULL DEFAULT true`.
- `created_at / updated_at timestamptz NOT NULL DEFAULT now()`; trigger.
- Constraints: `UNIQUE (player_user_id, game_key)`; optional `UNIQUE (game_key, game_user_id)` only if identifier proven globally unique per title — G1 does NOT add it (identifier unverified; duplicates allowed).
- Indexes: `UNIQUE (player_user_id, game_key)`; btree `(game_key, region_code, primary_role)` partial `WHERE is_visible = true`; GIN `(play_modes)`, GIN `(availability)`.

All tables: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. No table without RLS.

## 2. Primary/foreign keys, constraints, indexes summary

- PKs: `app_users.id`, `player_profiles.user_id`, `games.key`, `player_game_profiles.id`.
- FKs with explicit actions: `app_users.id → auth.users(id) CASCADE`; `player_profiles.user_id → app_users(id) CASCADE`; `player_game_profiles.player_user_id → player_profiles(user_id) CASCADE`; `game_key → games(key) RESTRICT` (prevent deleting a title with profiles).
- CHECKs mirror Zod (lengths, regex, allowlists, array caps). Array-subset CHECKs use `<@` with literal allowlists.
- Uniques: `lower(handle)` global; `(player, game)` pair.
- No FK from `game_user_id` to anything (unverified external identifier).

## 3. RLS policy matrix (proposed; names illustrative)

Deny by default. `anon` gets NO policies on base tables (no anon base access). `authenticated` owner-scoped. `service_role` bypasses RLS (platform default; used only server-side for admin/cleanup/signed URLs).

| Table | Operation | To | USING / WITH CHECK (essence) |
|---|---|---|---|
| `app_users` | SELECT | authenticated | `id = auth.uid()` (own row) |
| `app_users` | INSERT | authenticated | `id = auth.uid()` (bootstrap own row; `WITH CHECK id = auth.uid()`) |
| `app_users` | UPDATE | — | APPROVED D-G1-02: denied entirely. No owner UPDATE policy in G1; row immutable except through the explicitly authorized administrative boundary (service-role admin path for `status`). Owners cannot change account status, privileged flags or administrative attributes. |
| `app_users` | DELETE | — | No self-delete policy; deletion via server flow (service-role after confirmation). Prevents accidental cascade. |
| `player_profiles` | SELECT | authenticated | `user_id = auth.uid()` (own only) |
| `player_profiles` | INSERT | authenticated | `user_id = auth.uid()` + active-status EXISTS (see §4) |
| `player_profiles` | UPDATE | authenticated | `user_id = auth.uid()` USING + WITH CHECK (same; `is_discoverable` user-toggleable, other columns allowlisted in app) |
| `player_profiles` | DELETE | authenticated | `user_id = auth.uid()` |
| `player_game_profiles` | SELECT | authenticated | `player_user_id = auth.uid()` (own only; covers `EXISTS` join to player_profiles not needed since `player_user_id` is the owner key) |
| `player_game_profiles` | INSERT/UPDATE/DELETE | authenticated | `player_user_id = auth.uid()` (WITH CHECK same for writes) |
| `games` | SELECT | anon, authenticated | `true` (public catalogue; `is_active` filtered in app/RPC, not RLS — inactive titles hidden at query, existing profiles preserved) |
| `games` | ALL writes | — | No authenticated write policies; seeding via migration/service-role only |

Suspended guard (no DEFINER needed): write policies add `AND EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND status = 'active')`. Reads of own rows remain allowed when suspended (appeal/export); discovery projection (RPC) adds `status='active'` predicate.

## 4. Anonymous/authenticated access matrix

| Surface | anon | authenticated (non-owner) | owner | service-role |
|---|---|---|---|---|
| Base tables (`app_users`, `player_profiles`, `player_game_profiles`) | No access (no policies) | No access (policies require `= auth.uid()`) | Own rows CRUD per §3 | Bypass (admin/cleanup only, server-side) |
| `games` | SELECT | SELECT | SELECT | All (seed) |
| Public projection RPCs | EXECUTE (filtered) | EXECUTE (filtered, same as anon for others + own base rows separately) | EXECUTE + own base rows | EXECUTE/bypass as needed |
| Storage base (`storage.objects`) | Public SELECT only on 2 public buckets per existing policies (avatar/entity media reads); no avatar writes; no verification reads | Owner-scoped writes/reads per existing 8 policies; no entity-media writes | Same as authenticated | Full (signed URLs, cleanup) |

No broad `GRANT SELECT ON player_profiles TO anon/public`. No base-table public policies.

## 5. Public projection strategy (APPROVED D-G1-03: SECURITY DEFINER RPCs, not views)

Frozen position: two `SECURITY DEFINER` RPCs as the sole public read path in G1. No broad public views. View alternatives assessed in the review (`security_invoker=true/false`) are rejected.

- `search_player_directory(p_game text NULL, p_region text NULL, p_role text NULL, p_query text NULL, p_limit int DEFAULT 24, p_offset int DEFAULT 0)` RETURNS `SETOF player_directory_row` (explicit composite or `TABLE(...)` with the frozen allowlisted columns only: `handle, display_name, avatar_url, bio, country_code, game_key, game_name, ign, primary_role, play_modes, region_code, availability`).
- `get_player_by_handle(p_handle text)` RETURNS single projection row or 404-equivalent (empty set).

Why RPC over view (assessed alternatives):
- View with `security_invoker = true` (PG17): enforces base RLS as invoker. Since base denies anon, anon would get zero rows — useless for public directory unless base adds public policies (widens surface; rejected per “no broad public base access”).
- View with `security_invoker = false` (definer, legacy pattern): works (owner bypasses RLS, view WHERE filters), but search parameterization is awkward (query via `WHERE` on view still allows arbitrary column access if view ever gains columns; `SELECT *` drift risk; no clean limit-cap/ILIKE-escaping boundary).
- RPC advantages (frozen): explicit parameter allowlists, server-capped `LIMIT (≤48)` with bounded `OFFSET`, safe `ILIKE` with deliberate `ESCAPE`, fixed output column list (schema changes don’t leak new columns), single audit point. Matches “server-side query” preference in requirements.
- Parameter validation (frozen): Zod at the application boundary plus SQL-side checks at the database boundary. `p_handle` must satisfy handle syntax/length (`^[a-z0-9_]{3,20}$`, lowercased); `p_query` bounded length (application cap enforced before the call; SQL-side `LEFT(..., N)` guard); `p_limit` clamped to 1..48; `p_offset` bounded (non-negative with an explicit server maximum); `p_game`/`p_region`/`p_role` restricted to allowlisted catalogue values (NULL = unfiltered). No caller-controlled authorization identity is accepted.

RPC hardening (mandatory, frozen):
- `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''` (fully qualified `public.` tables inside).
- No dynamic SQL (`EXECUTE ... USING` forbidden in G1 RPCs); predicates are static with parameters.
- `REVOKE ALL ON FUNCTION ... FROM PUBLIC; GRANT EXECUTE ON FUNCTION ... TO anon, authenticated;`
- Owner `postgres`; function body references only `public.*` + `pg_catalog` builtins.
- Consent predicates inside function (not caller-supplied): `player.is_discoverable AND game.is_visible AND app_users.status='active' AND games.is_active`.
- Output columns frozen allowlist (see 04 §5): `handle, display_name, avatar_url, bio, country_code, game_key, game_name, ign, primary_role, play_modes, region_code, availability`. `game_user_id` omitted per D-G1-03 (masked form remains OPEN under D-G1-04); `user_id`/IDs omitted; no email, no private identifiers, no evidence; precise timestamps omitted (no year-exposed fallback). No `SELECT *` anywhere in the function bodies.
- `ILIKE` literal matching: escape `%`, `_` and `\` in caller input and use a deliberate `ESCAPE '\'` clause; leading-wildcard searches remain parameterized and capped by `LIMIT`/bounded `OFFSET` (throttling of public search endpoints is an explicit dependency, not invented here).
- 404-equivalence: `get_player_by_handle` returns zero rows for ineligible/nonexistent (caller maps to 404 without distinguishing).

## 6. SECURITY DEFINER risk analysis

- Attack surface: definer runs as owner (bypasses RLS). Mitigations: fixed `search_path=''`, no dynamic SQL, no user-controlled identifiers (table/column names static), `STABLE` (no writes), minimal GRANTs (EXECUTE only to anon/authenticated, no other roles), explicit predicates, output allowlist, `LIMIT` cap, `ILIKE` escaping.
- Residual risk: logic bug in predicate leaks ineligible rows. Mitigated by: RLS tests asserting anon/authenticated cannot read base tables directly (see 09), projection tests asserting revoked/ suspended/hidden rows absent, code review of the two functions as security boundary.
- No other DEFINER functions in G1. `handle_updated_at` remains `INVOKER` (foundation). Suspended check uses inline `EXISTS`, not a helper, to avoid an extra definer.
- Future reviewer/admin helpers (e.g., `is_org_admin()`) must be re-audited if introduced; G1 introduces none.

## 7. Service-role boundaries

- Allowed: Auth admin (account delete last step), storage signed-URL minting for verification evidence (future), avatar cleanup on profile/account delete, `games` seeding (migrations), admin suspension flips (future admin path).
- Forbidden: any browser import of admin client (see 07 — build/lint guard), any client-supplied service key, any base-table reads for others’ data via service-role to bypass projection (server routes for others use RPC/anon path, not service-role).
- Grants: `GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role` (foundation, retained). Per-table: `GRANT SELECT, INSERT, DELETE ON app_users TO authenticated` (no owner UPDATE grant per APPROVED D-G1-02; RLS still enforces rows; no grants to `anon` on base tables). `GRANT SELECT, INSERT, UPDATE, DELETE ON player_profiles, player_game_profiles TO authenticated` (RLS still enforces owner rows). `GRANT SELECT ON games TO anon, authenticated`. `GRANT EXECUTE ON search_player_directory, get_player_by_handle TO anon, authenticated`. No `GRANT ... TO public` on base tables.
