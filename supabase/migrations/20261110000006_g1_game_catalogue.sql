-- MicroNest Esports G1-3: game catalogue + player game profiles (D-G1-09).
--
-- Scope (APPROVED D-G1-09 game-specific vocabularies; D-G1-01/D-G1-02 reused):
--   1. public.games catalogue (key, name, short_name, is_active) + deterministic
--      idempotent BGMI seed. Catalogue mutations are migration/service-role
--      controlled; no authenticated write policies.
--   2. public.player_game_profiles (one row per (player, game)), owner-scoped
--      RLS (SELECT/INSERT/UPDATE; no DELETE pending D-G1-07, as in G1-2).
--   3. Explicit least-privilege grants (games: SELECT to anon+authenticated;
--      game profiles: SELECT/INSERT/UPDATE to authenticated, no DELETE grant).
--
-- Explicitly NOT included (later stages own them):
--   - Public projection RPCs (G1-4 owns them; D-G1-03/D-G1-04 stay open).
--     game_user_id is persisted owner-private and omitted from the future
--     projection; its masked form stays OPEN under D-G1-04.
--   - Avatar upload/storage integration (G1-5), public routes (G1-6),
--     consent/handle/deletion flows (G1-7; D-G1-05/D-G1-07/D-G1-08 stay open).
--   - No SECURITY DEFINER helpers (05 section 6 forbids extra definers in G1).
--   - No verification badge/score/rank columns (forbidden in G1).
--   - No modification of previous migrations (additive only).
--
-- Cardinality (03 section 3, 05 section 1): UNIQUE (player_user_id, game_key)
--   — exactly one profile per player per game. A second game for the same
--   player is a catalogue row + game-specific validation, never a
--   canonical-profile redesign (D-G1-09).
--
-- Availability vocabulary (03 section 3, A4): the frozen documents cite
--   availability windows only as non-exhaustive examples
--   ("e.g. weekday-evenings|weekend|flexible"). No literal value list is
--   frozen anywhere, so this migration enforces exactly what IS frozen
--   (NOT NULL, DEFAULT '{}', length cap <= 7, GIN index) plus no other
--   product vocabulary. Per-element shape is enforced at the Zod boundary.
--   A closed value allowlist lands via a later migration once product freezes
--   it — the array column + GIN index already support that without redesign.
--
-- Foreign-key behavior: player_user_id REFERENCES player_profiles(user_id)
--   ON DELETE CASCADE (no orphan game profiles; profile delete cascades);
--   game_key REFERENCES games(key) ON DELETE RESTRICT (a title with profiles
--   cannot be deleted; deactivation uses is_active, which preserves rows).
--   Neither action decides D-G1-07 (grace would delay the driving DELETE).
--
-- No multi-table mutation is introduced: game-profile creation requires an
--   existing canonical profile (FK enforces; no placeholder auto-creation per
--   02) and a supported active catalogue row (checked by the server operation;
--   FK enforces existence). Each operation is single-statement, so no
--   transactional RPC is needed. Direct PostgREST with caller RLS applies.

-- 1. Game catalogue ----------------------------------------------------------
create table public.games (
  key text primary key check (key ~ '^[a-z0-9-]{2,24}$'),
  name text not null,
  short_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.games is
  'G1-3 game catalogue: stable keys referenced by game profiles and future vacancies/opportunities. Writes are migration/service-role only.';
comment on column public.games.key is
  'Stable URL-safe catalogue key (e.g. bgmi). Adding a title = INSERT, no schema change.';
comment on column public.games.is_active is
  'Inactive titles hidden from creation at the server operation; existing profiles preserved (never hard-deleted by deactivation).';

-- Deterministic idempotent seed (05 section 1): the initial supported title.
insert into public.games (key, name, short_name, is_active)
values ('bgmi', 'Battlegrounds Mobile India', 'BGMI', true)
on conflict (key) do nothing;

-- 2. Player game profiles ----------------------------------------------------
create table public.player_game_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  player_user_id uuid not null references public.player_profiles (user_id) on delete cascade,
  game_key text not null references public.games (key) on delete restrict,
  ign text not null check (char_length(ign) between 2 and 30),
  game_user_id text null check (
    game_user_id is null or char_length(game_user_id) between 4 and 32
  ),
  primary_role text null check (
    primary_role is null or primary_role in ('IGL', 'Assaulter', 'Support', 'Scout')
  ),
  play_modes text[] not null default '{}' check (
    (array_length(play_modes, 1) is null or array_length(play_modes, 1) <= 5)
    and (play_modes <@ array['squad', 'duo', 'solo', 'tpp', 'fpp'])
  ),
  region_code text null check (
    region_code is null or region_code in ('india', 'asia', 'europe', 'north-america', 'south-america', 'middle-east', 'online')
  ),
  availability text[] not null default '{}' check (
    array_length(availability, 1) is null or array_length(availability, 1) <= 7
  ),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_user_id, game_key)
);

comment on table public.player_game_profiles is
  'G1-3 player game profiles: one row per (player, game). All fields self-declared; no verification status, ranks or scores in G1.';
comment on column public.player_game_profiles.id is
  'Surrogate PK (pgcrypto). Never in public URLs.';
comment on column public.player_game_profiles.player_user_id is
  'Owner key = player_profiles(user_id) = auth.uid(). Never caller-supplied.';
comment on column public.player_game_profiles.game_key is
  'Catalogue reference. Game-specific vocabularies are selected per this key (D-G1-09).';
comment on column public.player_game_profiles.game_user_id is
  'Optional title identifier as text (leading zeroes preserved). Owner-private; omitted from public projections (D-G1-03); masked form OPEN under D-G1-04. No UNIQUE: unverified identifiers may duplicate.';
comment on column public.player_game_profiles.region_code is
  'BGMI game-specific vocabulary (D-G1-09). ONLINE permitted here only because the BGMI vocabulary includes it; never valid as country_code.';
comment on column public.player_game_profiles.is_visible is
  'Per-game visibility. Effective public row needs player.is_discoverable AND this flag AND active account AND active game (G1-4 RPC predicate).';

-- Partial btree for directory prefilter (05 section 1; RPCs land in G1-4).
create index player_game_profiles_directory_idx
  on public.player_game_profiles (game_key, region_code, primary_role)
  where is_visible = true;

-- GIN indexes for array predicates (05 section 1).
create index player_game_profiles_play_modes_idx
  on public.player_game_profiles using gin (play_modes);
create index player_game_profiles_availability_idx
  on public.player_game_profiles using gin (availability);

-- Foundation reuse: single canonical updated_at trigger.
create trigger trg_player_game_profiles_updated_at
before update on public.player_game_profiles
for each row execute function public.handle_updated_at();

-- 3. Row Level Security ------------------------------------------------------
alter table public.games enable row level security;
alter table public.player_game_profiles enable row level security;

-- Public catalogue reads (05 section 3): anon + authenticated. is_active is
-- filtered at the query layer, not RLS — inactive titles hide from creation
-- while existing profiles are preserved.
create policy "games public select"
on public.games for select to anon, authenticated
using (true);

-- No authenticated write policies on games: seeding via migration /
-- service-role only (05 section 3).

-- Owner reads own game rows only (reads stay allowed when suspended).
create policy "player_game_profiles owner select"
on public.player_game_profiles for select to authenticated
using (player_user_id = auth.uid());

-- Owner creates own game rows only, when the account is active (suspended
-- guard via inline EXISTS, no DEFINER helper per 05 section 6). The
-- player_user_id column IS the owner key, so no join to player_profiles is
-- needed for isolation; the FK guarantees the canonical profile exists.
create policy "player_game_profiles owner insert"
on public.player_game_profiles for insert to authenticated
with check (
  player_user_id = auth.uid()
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
);

-- Owner updates own game rows only, when the account is active. Column
-- allowlists (no player_user_id/game_key/id in the generic patch) are
-- enforced at the application boundary (07); RLS binds the row.
create policy "player_game_profiles owner update"
on public.player_game_profiles for update to authenticated
using (
  player_user_id = auth.uid()
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
)
with check (
  player_user_id = auth.uid()
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
);

-- No owner DELETE policy in G1-3 (deferred pending D-G1-07, consistent with
-- G1-2; default-deny is the safe posture; removeGameProfile lands with the
-- approved delete path in G1-7). No anon policies on game-profile rows.

-- 4. Explicit grants (foundation lineage: never depend on implicit grants) ----
-- games: public catalogue reads only.
revoke all on table public.games from public;
grant select on table public.games to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
on table public.games
from anon, authenticated;

-- game profiles: least privilege for the approved G1-3 operations
-- (SELECT/INSERT/UPDATE via RLS). No DELETE grant (no DELETE policy while
-- D-G1-07 is open). service_role and the table owner are untouched.
revoke all on table public.player_game_profiles from public;
revoke all on table public.player_game_profiles from anon;
grant select, insert, update on table public.player_game_profiles to authenticated;
revoke delete, truncate, references, trigger
on table public.player_game_profiles
from authenticated;
