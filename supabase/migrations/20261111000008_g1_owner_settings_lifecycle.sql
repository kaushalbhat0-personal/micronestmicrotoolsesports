-- MicroNest Esports G1-7: owner settings, consent, handle cooldown and hard deletion.
--
-- Scope (APPROVED D-G1-05 Option A, D-G1-07 Option A, D-G1-08 approved set,
-- discoverability copy 2026-11-11):
--   1. ADD COLUMN public.player_profiles.handle_changed_at (smallest additive
--      persistence for the ~30-day handle cooldown). Pre-G1-7 schema carries
--      no handle-change timestamp; updated_at advances on ANY profile edit and
--      is therefore NOT a valid cooldown proxy. In-memory/client timers are
--      rejected (not durable across devices/restarts).
--   2. Owner DELETE capability (fail-closed until now): exact owner-only DELETE
--      policies + authenticated DELETE grants on player_profiles and
--      player_game_profiles. No anon DELETE, no broad access.
--   3. Direct-PostgREST bypass closure: owner UPDATE was column-unrestricted
--      (handle/is_discoverable directly writable via PostgREST). Tighten to
--      column-level UPDATE grants covering only the approved generic-patch
--      columns; handle + is_discoverable are now writable ONLY through the
--      narrow session-bound DEFINER functions below. Ownership columns stay
--      unwritable.
--   4. Narrow DEFINER functions (auth.uid() only, search_path='', fully
--      qualified, no dynamic SQL, active-status gate, least grants):
--        public.set_player_discoverability(boolean)
--        public.update_player_handle(text)  (~30-day atomic cooldown)
--
-- Explicitly NOT included: whole-account deletion, Auth identity deletion,
-- app_users writes, grace/pending/purge/scheduler, audit history, moderation,
-- onboarding, teams/orgs/brands, public-projection changes, game_user_id
-- exposure, service-role normal paths. No modification of previous migrations.

-- 1. Cooldown persistence -----------------------------------------------------
alter table public.player_profiles
  add column if not exists handle_changed_at timestamptz null;

comment on column public.player_profiles.handle_changed_at is
  'G1-7 handle-change cooldown marker (D-G1-05 Option A): set to now() ONLY on a successful dedicated handle change. NULL means no prior change (eligible). updated_at is NOT a proxy.';

-- 2. Owner DELETE policies (exact, active-gated) --------------------------------
-- Canonical profile: owner deletes own row only, when the account is active.
-- Associated game profiles cascade via FK ON DELETE CASCADE (approved).
create policy "player_profiles owner delete"
on public.player_profiles for delete to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
);

-- Game profile: owner deletes own rows only, when the account is active.
create policy "player_game_profiles owner delete"
on public.player_game_profiles for delete to authenticated
using (
  player_user_id = auth.uid()
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
);

-- 3. Grants --------------------------------------------------------------------
-- Least-privilege DELETE for the two approved hard-delete operations.
grant delete on table public.player_profiles to authenticated;
grant delete on table public.player_game_profiles to authenticated;

-- Close the direct-PostgREST bypass: replace table-level UPDATE with
-- column-level grants covering ONLY the approved generic-patch columns.
-- player_profiles generic patch (07): display_name, bio, country_code,
-- avatar_path (+ updated_at for the approved trigger). handle,
-- is_discoverable, user_id, handle_changed_at stay unwritable directly.
revoke update on table public.player_profiles from authenticated;
grant update (display_name, bio, country_code, avatar_path, updated_at)
on table public.player_profiles to authenticated;

-- player_game_profiles generic patch (07): ign, game_user_id, primary_role,
-- play_modes, region_code, availability, is_visible (+ updated_at).
-- id, player_user_id, game_key, created_at stay unwritable directly.
revoke update on table public.player_game_profiles from authenticated;
grant update (ign, game_user_id, primary_role, play_modes, region_code, availability, is_visible, updated_at)
on table public.player_game_profiles to authenticated;

-- 4. Narrow DEFINER functions -----------------------------------------------------
-- Consent toggle: session identity only, active gate, no caller user id.
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
  'G1-7 dedicated consent toggle (D-G1-05/D-G1-07 context): session-bound owner write of is_discoverable only. SECURITY DEFINER, auth.uid() identity, active gate, no dynamic SQL.';

revoke all on function public.set_player_discoverability(boolean) from public;
revoke all on function public.set_player_discoverability(boolean) from anon;
grant execute on function public.set_player_discoverability(boolean) to authenticated;

-- Handle change: session identity only, strict validation, case-insensitive
-- uniqueness via the existing lower(handle) index, atomic ~30-day cooldown.
-- Only a successful change sets handle_changed_at; failures leave it intact.
-- Concurrent attempts serialize on the row lock (FOR UPDATE).
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
  'G1-7 dedicated handle change (D-G1-05 Option A): session-bound, normalized, case-insensitive unique, atomic ~30-day cooldown. Only success advances handle_changed_at; concurrent attempts serialize on the row lock.';

revoke all on function public.update_player_handle(text) from public;
revoke all on function public.update_player_handle(text) from anon;
grant execute on function public.update_player_handle(text) to authenticated;
