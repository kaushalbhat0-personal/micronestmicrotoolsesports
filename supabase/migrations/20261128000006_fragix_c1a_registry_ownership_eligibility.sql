-- FRAGIX-C1A: ownership eligibility for public player registry search only.
-- Project: Esports knniommcyyhbyiwljisk. Never LMS.
--
-- Policy:
--   search_player_directory  → complete + is_discoverable + valid approved ownership
--   get_player_by_handle     → UNCHANGED (consent + completeness only; no ownership gate)
--
-- Consent (is_discoverable) is never cleared by this migration.
-- Frozen 12-column projection unchanged.
-- Does not grant table SELECT to anon/authenticated.

-- =============================================================================
-- 1. Narrow registry eligibility helper
-- =============================================================================

create or replace function public.player_bgmi_ownership_registry_eligible(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.player_bgmi_ownership_cases as c
    inner join public.player_game_profiles as pgp
      on pgp.player_user_id = c.player_id
     and pgp.game_key = 'bgmi'
    where c.player_id = p_player_id
      and c.status = 'approved'
      and c.claimed_game_user_id is not null
      and pgp.game_user_id is not null
      and pgp.game_user_id = c.claimed_game_user_id
  );
$$;

comment on function public.player_bgmi_ownership_registry_eligible(uuid) is
  'FRAGIX-C1A: true when player has an approved BGMI ownership case whose immutable claim still matches live game_user_id. Used only by search_player_directory. Does not read or expose evidence.';

revoke all on function public.player_bgmi_ownership_registry_eligible(uuid) from public;
revoke all on function public.player_bgmi_ownership_registry_eligible(uuid) from anon;
revoke all on function public.player_bgmi_ownership_registry_eligible(uuid) from authenticated;
-- Invoked only by SECURITY DEFINER search_player_directory (owner rights).

-- =============================================================================
-- 2. Gate registry search — leave get_player_by_handle untouched
-- =============================================================================

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
    and public.player_profile_is_complete(pp.user_id)
    and public.player_bgmi_ownership_registry_eligible(pp.user_id)
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
  'G1-4 directory search + M2B.1 completeness + FRAGIX-C1A ownership eligibility. Frozen 12 columns. get_player_by_handle remains ownership-ungated.';

revoke all on function public.search_player_directory(text, text, text, text, integer, integer) from public;
revoke all on function public.search_player_directory(text, text, text, text, integer, integer) from anon, authenticated;
grant execute on function public.search_player_directory(text, text, text, text, integer, integer) to anon, authenticated;
