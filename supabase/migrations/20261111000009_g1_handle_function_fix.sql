-- MicroNest Esports G1-7: handle-function ambiguity fix (follow-up).
-- The OUT parameters of update_player_handle (RETURNS TABLE) shadow the
-- player_profiles column names inside the plpgsql body, so the unqualified
-- `where user_id = v_uid` in the row lock raised 42702 (ambiguous column).
-- Fix: fully qualify the row-lock predicate. Additive only (CREATE OR
-- REPLACE + least-privilege grants re-asserted). No other behavior changes.
create or replace function public.update_player_handle(p_handle text)
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
  v_handle text;
  v_row public.player_profiles%rowtype;
  v_eligible_at timestamptz;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_handle is null then
    raise exception 'invalid handle' using errcode = '22000';
  end if;
  v_handle := pg_catalog.lower(pg_catalog.btrim(p_handle));
  if v_handle is null
    or pg_catalog.char_length(v_handle) < 3
    or pg_catalog.char_length(v_handle) > 20
    or v_handle !~ '^[a-z0-9_]{3,20}$'
  then
    raise exception 'invalid handle' using errcode = '22000';
  end if;
  if not exists (
    select 1 from public.app_users
    where id = v_uid and status = 'active'
  ) then
    raise exception 'account not active' using errcode = '28000';
  end if;

  -- OUT params (user_id, handle, ...) shadow column names: qualify.
  select * into v_row
  from public.player_profiles
  where public.player_profiles.user_id = v_uid
  for update;
  if not found then
    raise exception 'profile not found' using errcode = '02000';
  end if;

  -- No-op (same value, case-insensitive after normalization): return the row
  -- without advancing the cooldown.
  if pg_catalog.lower(v_row.handle) = v_handle then
    return query
    select
      v_row.user_id,
      v_row.handle,
      v_row.display_name,
      v_row.avatar_path,
      v_row.bio,
      v_row.country_code,
      v_row.is_discoverable,
      v_row.handle_changed_at,
      v_row.created_at,
      v_row.updated_at;
    return;
  end if;

  if v_row.handle_changed_at is not null then
    v_eligible_at := v_row.handle_changed_at + interval '30 days';
    if pg_catalog.now() < v_eligible_at then
      raise exception 'HANDLE_COOLDOWN:%', v_eligible_at using errcode = 'P0001';
    end if;
  end if;

  return query
  update public.player_profiles as p
  set
    handle = v_handle,
    handle_changed_at = pg_catalog.now()
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
exception
  when unique_violation then
    raise exception 'handle taken' using errcode = '23505';
end;
$$;

comment on function public.update_player_handle(text) is
  'G1-7 dedicated handle change (D-G1-05 Option A): session-bound, normalized, case-insensitive unique, atomic ~30-day cooldown. Ambiguity fix: OUT params shadow column names, so the row lock qualifies user_id.';

revoke all on function public.update_player_handle(text) from public;
revoke all on function public.update_player_handle(text) from anon;
grant execute on function public.update_player_handle(text) to authenticated;
