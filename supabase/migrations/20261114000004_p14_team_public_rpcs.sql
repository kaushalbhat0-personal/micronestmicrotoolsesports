-- P14-D3 masked public team RPCs (search_teams / get_team_by_slug).
-- Depends on: teams, team_members. G1 player RPCs untouched.

create or replace function public.search_teams(
  p_game text default null,
  p_region text default null,
  p_query text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  name text,
  game_key text,
  region_code text,
  current_level text,
  target_level text,
  recruiting boolean,
  member_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select nullif(btrim(p_query), '') as raw
  ),
  escaped as (
    select case
      when raw is null then null
      else replace(replace(replace(left(raw, 120), '\', '\\'), '%', '\%'), '_', '\_')
    end as lit
    from q
  )
  select
    t.id,
    t.slug,
    t.name,
    t.game_key,
    t.region_code,
    t.current_level,
    t.target_level,
    t.recruiting,
    (
      select count(*)::bigint
      from public.team_members m
      where m.team_id = t.id
        and m.membership_status = 'active'
    ) as member_count
  from public.teams t
  cross join escaped e
  where t.is_public = true
    and t.lifecycle_status = 'active'
    and (p_game is null or t.game_key = p_game)
    and (p_region is null or t.region_code = p_region)
    and (
      e.lit is null
      or t.name ilike '%' || e.lit || '%' escape '\'
      or t.slug ilike '%' || e.lit || '%' escape '\'
    )
  order by t.created_at desc
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset least(greatest(coalesce(p_offset, 0), 0), 1000);
$$;

create or replace function public.get_team_by_slug(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  game_key text,
  region_code text,
  description text,
  current_level text,
  target_level text,
  recruiting boolean,
  member_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.slug,
    t.name,
    t.game_key,
    t.region_code,
    t.description,
    t.current_level,
    t.target_level,
    t.recruiting,
    (
      select count(*)::bigint
      from public.team_members m
      where m.team_id = t.id
        and m.membership_status = 'active'
    ) as member_count
  from public.teams t
  where t.slug = p_slug
    and t.is_public = true
    and t.lifecycle_status = 'active'
  limit 1;
$$;

comment on function public.search_teams(text, text, text, integer, integer) is
  'P14 masked team search: public+active only, escaped ILIKE, clamped pagination, active member_count only.';
comment on function public.get_team_by_slug(text) is
  'P14 masked team detail: public+active only; no owner/member identities.';

revoke all on function public.search_teams(text, text, text, integer, integer) from public;
revoke all on function public.get_team_by_slug(text) from public;
grant execute on function public.search_teams(text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.get_team_by_slug(text) to anon, authenticated;
