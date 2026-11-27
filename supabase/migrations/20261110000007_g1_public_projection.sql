-- MicroNest Esports G1-4: public player directory projection (D-G1-03 + D-G1-04 Option A).
--
-- Scope (APPROVED D-G1-03 RPC-only; APPROVED D-G1-04 Option A omit 2026-11-11):
--   1. public.search_player_directory(...) + public.get_player_by_handle(...)
--      as the SOLE public read path for other users' data. Both are
--      LANGUAGE sql STABLE SECURITY DEFINER with SET search_path = ''.
--   2. Frozen 12-column output, in this exact order: handle, display_name,
--      avatar_url, bio, country_code, game_key, game_name, ign, primary_role,
--      play_modes, region_code, availability. avatar_url carries the stored
--      relative object path (player_profiles.avatar_path); the application
--      resolves it to a public storage URL (06 section 2). No game_user_id in
--      any form (full or masked), no user IDs, no emails, no evidence, no
--      timestamps.
--   3. Consent + status predicates enforced INSIDE the functions (never caller
--      supplied): player_profiles.is_discoverable AND
--      player_game_profiles.is_visible AND app_users.status = 'active' AND
--      games.is_active.
--   4. Least-privilege grants: REVOKE ALL FROM PUBLIC, GRANT EXECUTE TO
--      anon, authenticated only.
--
-- Explicitly NOT included (later stages own them):
--   - No base-table policy or grant changes (05 sections 3-4 and the 07
--     service-role boundaries are unchanged).
--   - No verification status, badge or ownership claim (forbidden by D-G1-04).
--   - No game_user_id search, filtering, matching or deduplication
--     (forbidden by D-G1-04).
--   - No broad views, no dynamic SQL, no additional RPCs.
--   - No modification of previous migrations (additive only).
--
-- Pagination bounds: p_limit is clamped 1..48 (frozen), p_offset is clamped
--   0..1000 as a technical DoS guard (public endpoint throttling itself stays
--   open under D-G1-05). p_query is trimmed, capped at 120 characters
--   SQL-side (mirrors the Zod boundary), and matched literally: percent,
--   underscore and backslash are escaped with a deliberate ESCAPE clause, so
--   caller input can never widen into a wildcard enumeration oracle.
--   Unknown game/region/role values match zero rows (fail closed, no oracle:
--   indistinguishable from a valid filter with no results).

-- 1. Directory search ---------------------------------------------------------
create or replace function public.search_player_directory(
  p_game text default null,
  p_region text default null,
  p_role text default null,
  p_query text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  handle text,
  display_name text,
  avatar_url text,
  bio text,
  country_code text,
  game_key text,
  game_name text,
  ign text,
  primary_role text,
  play_modes text[],
  region_code text,
  availability text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with raw as (
    select
      nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_game, ''))), '') as v_game,
      nullif(pg_catalog.lower(pg_catalog.btrim(coalesce(p_region, ''))), '') as v_region,
      nullif(pg_catalog.btrim(coalesce(p_role, '')), '') as v_role,
      nullif(pg_catalog.btrim(coalesce(p_query, '')), '') as v_query_raw,
      case
        when coalesce(p_limit, 24) < 1 then 1
        when coalesce(p_limit, 24) > 48 then 48
        else coalesce(p_limit, 24)
      end as v_limit,
      case
        when coalesce(p_offset, 0) < 0 then 0
        when coalesce(p_offset, 0) > 1000 then 1000
        else coalesce(p_offset, 0)
      end as v_offset
  ),
  params as (
    select
      raw.v_game,
      raw.v_region,
      raw.v_role,
      raw.v_limit,
      raw.v_offset,
      case
        when raw.v_query_raw is null then null
        else '%' || pg_catalog.replace(
          pg_catalog.replace(
            pg_catalog.replace(pg_catalog.left(raw.v_query_raw, 120), '\', '\\'),
            '%', '\%'
          ),
          '_', '\_'
        ) || '%'
      end as v_pattern
    from raw
  )
  select
    pp.handle,
    pp.display_name,
    pp.avatar_path as avatar_url,
    pp.bio,
    pp.country_code::text,
    pgp.game_key,
    g.name as game_name,
    pgp.ign,
    pgp.primary_role,
    pgp.play_modes,
    pgp.region_code,
    pgp.availability
  from public.player_profiles as pp
  join public.app_users as au on au.id = pp.user_id
  join public.player_game_profiles as pgp on pgp.player_user_id = pp.user_id
  join public.games as g on g.key = pgp.game_key
  cross join params
  where pp.is_discoverable = true
    and pgp.is_visible = true
    and au.status = 'active'
    and g.is_active = true
    and (params.v_game is null or pgp.game_key = params.v_game)
    and (params.v_region is null or pgp.region_code = params.v_region)
    and (params.v_role is null or pgp.primary_role = params.v_role)
    and (
      params.v_pattern is null
      or pp.handle ilike params.v_pattern escape '\'
      or pp.display_name ilike params.v_pattern escape '\'
      or pgp.ign ilike params.v_pattern escape '\'
    )
  order by pp.handle asc, pgp.game_key asc
  limit (select params.v_limit from params)
  offset (select params.v_offset from params);
$$;

comment on function public.search_player_directory(text, text, text, text, integer, integer) is
  'G1-4 public directory search (D-G1-03 RPC-only, D-G1-04 Option A omit 2026-11-11): frozen 12 columns, consent + active predicates enforced inside, ILIKE-escaped query, LIMIT 1..48, OFFSET 0..1000. avatar_url is the stored relative avatar_path; the app resolves the public URL.';

-- 2. Profile lookup by handle --------------------------------------------------
create or replace function public.get_player_by_handle(p_handle text)
returns table (
  handle text,
  display_name text,
  avatar_url text,
  bio text,
  country_code text,
  game_key text,
  game_name text,
  ign text,
  primary_role text,
  play_modes text[],
  region_code text,
  availability text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    pp.handle,
    pp.display_name,
    pp.avatar_path as avatar_url,
    pp.bio,
    pp.country_code::text,
    pgp.game_key,
    g.name as game_name,
    pgp.ign,
    pgp.primary_role,
    pgp.play_modes,
    pgp.region_code,
    pgp.availability
  from public.player_profiles as pp
  join public.app_users as au on au.id = pp.user_id
  join public.player_game_profiles as pgp on pgp.player_user_id = pp.user_id
  join public.games as g on g.key = pgp.game_key
  where pg_catalog.lower(pp.handle) = pg_catalog.lower(pg_catalog.btrim(coalesce(p_handle, '')))
    and pg_catalog.lower(pg_catalog.btrim(coalesce(p_handle, ''))) ~ '^[a-z0-9_]{3,20}$'
    and pp.is_discoverable = true
    and pgp.is_visible = true
    and au.status = 'active'
    and g.is_active = true
  order by pgp.game_key asc;
$$;

comment on function public.get_player_by_handle(text) is
  'G1-4 public profile lookup (D-G1-03 RPC-only, D-G1-04 Option A omit 2026-11-11): frozen 12 columns, consent + active predicates enforced inside, case-insensitive handle match, 404-equivalence (zero rows for missing/private/suspended/inactive).';

-- 3. Least-privilege execution grants -------------------------------------------
-- Foundation lineage: revoke from every API-facing role first, then grant the
-- approved minimum. No table grants change in this migration.
revoke all on function public.search_player_directory(text, text, text, text, integer, integer) from public;
revoke all on function public.search_player_directory(text, text, text, text, integer, integer) from anon, authenticated;
grant execute on function public.search_player_directory(text, text, text, text, integer, integer) to anon, authenticated;

revoke all on function public.get_player_by_handle(text) from public;
revoke all on function public.get_player_by_handle(text) from anon, authenticated;
grant execute on function public.get_player_by_handle(text) to anon, authenticated;
