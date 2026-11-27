-- P15-M2B.1: Discoverability requires D-G1-08 profile completeness + consent.
-- Additive only: helper + replace set_player_discoverability + public RPCs.
-- Does NOT widen the frozen 12-column public projection.
-- Does NOT clear is_discoverable when a profile becomes incomplete — consent
-- preference is preserved; public RPCs independently require completeness so
-- incomplete consented profiles stay invisible until complete again.
-- Rollback: restore prior function bodies from 20261111000008 + 20261110000007
-- and drop public.player_profile_is_complete(uuid).

-- 1. Canonical completeness helper (mirrors src/.../completeness.ts D-G1-08) ----
create or replace function public.player_profile_is_complete(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.player_profiles as pp
    where pp.user_id = p_user_id
      and pg_catalog.length(pg_catalog.btrim(pp.handle)) > 0
      and pg_catalog.length(pg_catalog.btrim(pp.display_name)) > 0
      and (
        (pp.avatar_path is not null and pg_catalog.length(pp.avatar_path) > 0)
        or (pp.bio is not null and pg_catalog.length(pg_catalog.btrim(pp.bio)) > 0)
      )
      and exists (
        select 1
        from public.player_game_profiles as pgp
        where pgp.player_user_id = pp.user_id
      )
  );
$$;

comment on function public.player_profile_is_complete(uuid) is
  'P15-M2B.1 D-G1-08 completeness: handle + display_name + (avatar_path OR non-empty bio) + >=1 game profile. Used by consent enable gate and public directory RPCs.';

revoke all on function public.player_profile_is_complete(uuid) from public;
revoke all on function public.player_profile_is_complete(uuid) from anon, authenticated;

-- 2. Consent toggle: enable only when complete; disable always allowed --------
create or replace function public.set_player_discoverability(p_value boolean)
returns table (
  user_id uuid,
  handle text,
  display_name text,
  avatar_path text,
  bio text,
  country_code char(2),
  is_discoverable boolean,
  handle_changed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_value is null then
    raise exception 'invalid input' using errcode = '22000';
  end if;
  if not exists (
    select 1 from public.app_users
    where id = v_uid and status = 'active'
  ) then
    raise exception 'account not active' using errcode = '28000';
  end if;
  if p_value is true and not public.player_profile_is_complete(v_uid) then
    raise exception 'profile incomplete' using errcode = '22000';
  end if;
  return query
  update public.player_profiles as p
  set is_discoverable = p_value
  where p.user_id = v_uid
  returning
    p.user_id,
    p.handle,
    p.display_name,
    p.avatar_path,
    p.bio,
    p.country_code,
    p.is_discoverable,
    p.handle_changed_at,
    p.created_at,
    p.updated_at;
  return;
end;
$$;

comment on function public.set_player_discoverability(boolean) is
  'G1-7 consent toggle + P15-M2B.1: enable requires D-G1-08 completeness; disable always allowed. SECURITY DEFINER, auth.uid() identity, active gate.';

revoke all on function public.set_player_discoverability(boolean) from public;
revoke all on function public.set_player_discoverability(boolean) from anon;
grant execute on function public.set_player_discoverability(boolean) to authenticated;

-- 3. Public search — preserve exact signature from 20261110000007 -------------
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
  'G1-4 public directory search + P15-M2B.1 completeness gate. Frozen 12 columns unchanged.';

revoke all on function public.search_player_directory(text, text, text, text, integer, integer) from public;
revoke all on function public.search_player_directory(text, text, text, text, integer, integer) from anon, authenticated;
grant execute on function public.search_player_directory(text, text, text, text, integer, integer) to anon, authenticated;

-- 4. Public handle lookup — same completeness gate ----------------------------
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
    and public.player_profile_is_complete(pp.user_id)
    and pgp.is_visible = true
    and au.status = 'active'
    and g.is_active = true
  order by pgp.game_key asc;
$$;

comment on function public.get_player_by_handle(text) is
  'G1-4 public profile lookup + P15-M2B.1 completeness gate. Frozen 12 columns unchanged. 404-equivalence for incomplete consented profiles.';

revoke all on function public.get_player_by_handle(text) from public;
revoke all on function public.get_player_by_handle(text) from anon, authenticated;
grant execute on function public.get_player_by_handle(text) to anon, authenticated;
