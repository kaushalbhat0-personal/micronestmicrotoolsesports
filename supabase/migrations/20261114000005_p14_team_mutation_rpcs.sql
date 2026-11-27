-- P14-D3 mutation RPCs: create_team, update_team_settings.
-- A1/A4/A5: session identity, verified email, atomic captain seed, owner/captain settings.
-- No transfer / leave / appoint / recruitment RPCs.

create or replace function public.create_team(
  p_slug text,
  p_name text,
  p_game_key text,
  p_region_code text,
  p_current_level text,
  p_target_level text,
  p_description text default null,
  p_recruiting boolean default true,
  p_is_public boolean default true
)
returns table (id uuid, slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_team_id uuid;
  v_slug text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.app_users au
    where au.id = v_uid and au.status = 'active'
  ) then
    raise exception 'account not active' using errcode = '42501';
  end if;

  if not exists (
    select 1 from auth.users u
    where u.id = v_uid and u.email_confirmed_at is not null
  ) then
    raise exception 'email not verified' using errcode = '42501';
  end if;

  insert into public.teams (
    slug,
    name,
    game_key,
    region_code,
    current_level,
    target_level,
    description,
    recruiting,
    is_public,
    owner_user_id,
    created_by
  ) values (
    p_slug,
    p_name,
    p_game_key,
    p_region_code,
    p_current_level,
    p_target_level,
    nullif(btrim(coalesce(p_description, '')), ''),
    coalesce(p_recruiting, true),
    coalesce(p_is_public, true),
    v_uid,
    v_uid
  )
  returning public.teams.id, public.teams.slug into v_team_id, v_slug;

  insert into public.team_members (
    team_id,
    user_id,
    role,
    membership_status,
    joined_at
  ) values (
    v_team_id,
    v_uid,
    'captain',
    'active',
    now()
  );

  insert into public.team_audit_events (
    team_id,
    actor_user_id,
    event_type,
    payload
  ) values (
    v_team_id,
    v_uid,
    'team.created',
    jsonb_build_object('slug', v_slug, 'game_key', p_game_key)
  );

  return query select v_team_id, v_slug;
exception
  when unique_violation then
    raise exception 'slug conflict' using errcode = '23505';
end;
$$;

comment on function public.create_team(text, text, text, text, text, text, text, boolean, boolean) is
  'P14 A4/A5: session-derived owner+captain seed+audit. No caller-selected owner/role.';

create or replace function public.update_team_settings(
  p_team_id uuid,
  p_name text,
  p_region_code text,
  p_current_level text,
  p_target_level text,
  p_description text default null,
  p_recruiting boolean default true,
  p_is_public boolean default true
)
returns table (id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.app_users au
    where au.id = v_uid and au.status = 'active'
  ) then
    raise exception 'account not active' using errcode = '42501';
  end if;

  -- A1: owner or active captain only (co-captain excluded by is_team_captain).
  if not public.is_team_captain(p_team_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.teams t
  set
    name = p_name,
    region_code = p_region_code,
    current_level = p_current_level,
    target_level = p_target_level,
    description = nullif(btrim(coalesce(p_description, '')), ''),
    recruiting = coalesce(p_recruiting, true),
    is_public = coalesce(p_is_public, true)
  where t.id = p_team_id
  returning t.id into v_id;

  if v_id is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.team_audit_events (
    team_id,
    actor_user_id,
    event_type,
    payload
  ) values (
    v_id,
    v_uid,
    'team.settings_updated',
    jsonb_build_object('name', p_name)
  );

  return query select v_id;
end;
$$;

comment on function public.update_team_settings(uuid, text, text, text, text, text, boolean, boolean) is
  'P14 A1: owner or active captain may edit allowlisted fields only; audits settings_updated.';

revoke all on function public.create_team(text, text, text, text, text, text, text, boolean, boolean) from public;
revoke all on function public.update_team_settings(uuid, text, text, text, text, text, boolean, boolean) from public;
grant execute on function public.create_team(text, text, text, text, text, text, text, boolean, boolean) to authenticated;
grant execute on function public.update_team_settings(uuid, text, text, text, text, text, boolean, boolean) to authenticated;
