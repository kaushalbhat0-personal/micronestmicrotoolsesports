-- P15-M2B.3B: Private BGMI ownership evidence metadata + Storage DELETE hardening.
-- Project: Esports only (knniommcyyhbyiwljisk). Never LMS.
-- Additive: cases/evidence tables, RLS, submit/withdraw RPCs, ID-mismatch trigger,
--           Storage INSERT/DELETE predicates for bgmi-ownership paths.
-- Does NOT: tighten bucket MIME (PDF remains at bucket level; app rejects),
--           approve/reject, public projection changes, reviewer Storage SELECT.
-- Rollback: drop policies/functions/triggers/tables in reverse; restore prior
--           private-verification insert/delete policies from 20261110000002.

-- =============================================================================
-- 1. Tables
-- =============================================================================

create table public.player_bgmi_ownership_cases (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.app_users (id) on delete cascade,
  status text not null
    check (status in ('draft', 'pending_review', 'withdrawn', 'id_mismatch')),
  claimed_game_user_id text null,
  identity_mismatch boolean not null default false,
  evidence_count integer not null default 0
    check (evidence_count >= 0 and evidence_count <= 2),
  submitted_at timestamptz null,
  withdrawn_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_bgmi_ownership_cases_claimed_id_len_chk check (
    claimed_game_user_id is null
    or (
      char_length(claimed_game_user_id) between 4 and 32
      and claimed_game_user_id !~ '[\u0000-\u001F\u007F]'
    )
  ),
  constraint player_bgmi_ownership_cases_pending_requires_claim_chk check (
    status not in ('pending_review', 'id_mismatch')
    or (
      claimed_game_user_id is not null
      and evidence_count between 1 and 2
      and submitted_at is not null
    )
  ),
  constraint player_bgmi_ownership_cases_withdrawn_chk check (
    status <> 'withdrawn'
    or withdrawn_at is not null
  )
);

comment on table public.player_bgmi_ownership_cases is
  'P15-M2B.3B: private BGMI ownership verification cases. claimed_game_user_id is an immutable snapshot at submit.';

comment on column public.player_bgmi_ownership_cases.claimed_game_user_id is
  'Immutable BGMI Player ID snapshot at submit. Never updated to follow live game_user_id. Cleared on withdraw.';

create unique index player_bgmi_ownership_cases_one_active_uidx
  on public.player_bgmi_ownership_cases (player_id)
  where status in ('draft', 'pending_review');

create index player_bgmi_ownership_cases_player_status_idx
  on public.player_bgmi_ownership_cases (player_id, status);

create trigger trg_player_bgmi_ownership_cases_updated_at
before update on public.player_bgmi_ownership_cases
for each row execute function public.handle_updated_at();

create table public.player_bgmi_ownership_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null
    references public.player_bgmi_ownership_cases (id) on delete cascade,
  player_id uuid not null references public.app_users (id) on delete cascade,
  storage_bucket text not null default 'private-verification'
    check (storage_bucket = 'private-verification'),
  storage_path text not null,
  content_type text not null
    check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 5242880),
  width integer not null check (width >= 64 and width <= 8192),
  height integer not null check (height >= 64 and height <= 8192),
  sha256 text not null check (char_length(sha256) = 64),
  sort_order smallint not null check (sort_order in (1, 2)),
  created_at timestamptz not null default now(),
  constraint player_bgmi_ownership_evidence_path_uidx unique (storage_path),
  constraint player_bgmi_ownership_evidence_case_sort_uidx unique (case_id, sort_order)
);

comment on table public.player_bgmi_ownership_evidence is
  'P15-M2B.3B: sanitized evidence object metadata. No raw image bytes. Max two rows per case.';

create index player_bgmi_ownership_evidence_case_idx
  on public.player_bgmi_ownership_evidence (case_id);

create index player_bgmi_ownership_evidence_player_idx
  on public.player_bgmi_ownership_evidence (player_id);

-- Abuse / rate-limit event log (server RPC only; no client SELECT of others).
create table public.player_bgmi_ownership_rate_events (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.app_users (id) on delete cascade,
  event_type text not null
    check (event_type in ('create_case', 'upload', 'submit', 'withdraw', 'signed_url')),
  created_at timestamptz not null default now()
);

create index player_bgmi_ownership_rate_events_lookup_idx
  on public.player_bgmi_ownership_rate_events (player_id, event_type, created_at desc);

-- =============================================================================
-- 2. Immutability + evidence_count maintenance
-- =============================================================================

create or replace function public.tg_player_bgmi_ownership_cases_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- claimed_game_user_id is immutable once set, except withdraw clear via GUC.
    if old.claimed_game_user_id is not null
       and new.claimed_game_user_id is distinct from old.claimed_game_user_id then
      if coalesce(current_setting('micronest.bgmi_ownership_allow_claim_clear', true), '') <> '1' then
        raise exception 'claimed_game_user_id is immutable';
      end if;
    end if;

    -- Clients must not jump to pending_review / id_mismatch without RPC.
    if old.status = 'draft' and new.status in ('pending_review', 'id_mismatch') then
      if coalesce(current_setting('micronest.bgmi_ownership_allow_submit', true), '') <> '1' then
        raise exception 'status transition requires submit RPC';
      end if;
    end if;

    if old.status in ('pending_review', 'id_mismatch') and new.status = 'withdrawn' then
      if coalesce(current_setting('micronest.bgmi_ownership_allow_withdraw', true), '') <> '1' then
        raise exception 'withdraw requires withdraw RPC';
      end if;
    end if;

    if old.status = 'draft' and new.status = 'withdrawn' then
      if coalesce(current_setting('micronest.bgmi_ownership_allow_withdraw', true), '') <> '1' then
        raise exception 'withdraw requires withdraw RPC';
      end if;
    end if;

    -- id_mismatch only via trigger/RPC GUC
    if new.status = 'id_mismatch'
       and old.status is distinct from 'id_mismatch' then
      if coalesce(current_setting('micronest.bgmi_ownership_allow_id_mismatch', true), '') <> '1' then
        raise exception 'id_mismatch requires system flagger';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_player_bgmi_ownership_cases_guard
before update on public.player_bgmi_ownership_cases
for each row execute function public.tg_player_bgmi_ownership_cases_guard();

create or replace function public.tg_player_bgmi_ownership_evidence_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.player_bgmi_ownership_cases
      set evidence_count = evidence_count + 1
      where id = new.case_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.player_bgmi_ownership_cases
      set evidence_count = greatest(evidence_count - 1, 0)
      where id = old.case_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger trg_player_bgmi_ownership_evidence_count
after insert or delete on public.player_bgmi_ownership_evidence
for each row execute function public.tg_player_bgmi_ownership_evidence_count();

create or replace function public.tg_player_bgmi_ownership_evidence_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  case_status text;
  case_player uuid;
begin
  if tg_op = 'INSERT' then
    select c.status, c.player_id into case_status, case_player
    from public.player_bgmi_ownership_cases c
    where c.id = new.case_id;

    if case_status is null then
      raise exception 'case not found';
    end if;
    if case_player <> new.player_id then
      raise exception 'evidence player_id must match case';
    end if;
    if case_status <> 'draft' then
      raise exception 'evidence only attachable to draft cases';
    end if;
    if (
      select count(*) from public.player_bgmi_ownership_evidence e
      where e.case_id = new.case_id
    ) >= 2 then
      raise exception 'maximum two evidence objects per case';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    raise exception 'evidence rows are immutable';
  end if;

  if tg_op = 'DELETE' then
    select c.status into case_status
    from public.player_bgmi_ownership_cases c
    where c.id = old.case_id;
    if case_status is not null
       and case_status not in ('draft', 'withdrawn') then
      raise exception 'cannot delete evidence for submitted cases outside withdraw';
    end if;
    return old;
  end if;

  return null;
end;
$$;

create trigger trg_player_bgmi_ownership_evidence_guard
before insert or update or delete on public.player_bgmi_ownership_evidence
for each row execute function public.tg_player_bgmi_ownership_evidence_guard();

-- Flag pending cases when live BGMI game_user_id changes.
create or replace function public.tg_flag_bgmi_ownership_id_mismatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.game_key = 'bgmi'
     and old.game_user_id is distinct from new.game_user_id then
    perform set_config('micronest.bgmi_ownership_allow_id_mismatch', '1', true);
    update public.player_bgmi_ownership_cases c
      set status = 'id_mismatch',
          identity_mismatch = true
      where c.player_id = new.player_user_id
        and c.status = 'pending_review'
        and c.claimed_game_user_id is distinct from new.game_user_id;
  end if;
  return new;
end;
$$;

create trigger trg_player_game_profiles_bgmi_ownership_mismatch
after update of game_user_id on public.player_game_profiles
for each row execute function public.tg_flag_bgmi_ownership_id_mismatch();

-- =============================================================================
-- 3. RLS
-- =============================================================================

alter table public.player_bgmi_ownership_cases enable row level security;
alter table public.player_bgmi_ownership_evidence enable row level security;
alter table public.player_bgmi_ownership_rate_events enable row level security;

revoke all on table public.player_bgmi_ownership_cases from public, anon;
revoke all on table public.player_bgmi_ownership_evidence from public, anon;
revoke all on table public.player_bgmi_ownership_rate_events from public, anon, authenticated;

grant select, insert on table public.player_bgmi_ownership_cases to authenticated;
grant update (updated_at) on table public.player_bgmi_ownership_cases to authenticated;
-- Status transitions go through SECURITY DEFINER RPCs (table owner).
grant select, insert, delete on table public.player_bgmi_ownership_evidence to authenticated;
-- rate_events: no direct grants; RPCs only

create policy player_bgmi_ownership_cases_owner_select
on public.player_bgmi_ownership_cases
for select
to authenticated
using (player_id = auth.uid() or public.is_super_admin());

create policy player_bgmi_ownership_cases_owner_insert
on public.player_bgmi_ownership_cases
for insert
to authenticated
with check (
  player_id = auth.uid()
  and status = 'draft'
  and claimed_game_user_id is null
  and identity_mismatch = false
  and evidence_count = 0
  and submitted_at is null
  and withdrawn_at is null
  and exists (
    select 1 from public.app_users au
    where au.id = auth.uid() and au.status = 'active'
  )
);

-- No broad owner UPDATE policy — prevents client status spoofing.
-- Super-admin read-only for now (M2B.4 decisions later).

create policy player_bgmi_ownership_evidence_owner_select
on public.player_bgmi_ownership_evidence
for select
to authenticated
using (player_id = auth.uid() or public.is_super_admin());

create policy player_bgmi_ownership_evidence_owner_insert
on public.player_bgmi_ownership_evidence
for insert
to authenticated
with check (
  player_id = auth.uid()
  and exists (
    select 1 from public.player_bgmi_ownership_cases c
    where c.id = case_id
      and c.player_id = auth.uid()
      and c.status = 'draft'
  )
  and exists (
    select 1 from public.app_users au
    where au.id = auth.uid() and au.status = 'active'
  )
);

create policy player_bgmi_ownership_evidence_owner_delete
on public.player_bgmi_ownership_evidence
for delete
to authenticated
using (
  player_id = auth.uid()
  and exists (
    select 1 from public.player_bgmi_ownership_cases c
    where c.id = case_id
      and c.player_id = auth.uid()
      and c.status in ('draft', 'withdrawn')
  )
);

-- =============================================================================
-- 4. RPCs: rate limit, submit, withdraw
-- =============================================================================

create or replace function public.assert_bgmi_ownership_rate_limit(
  p_event_type text,
  p_limit integer,
  p_window_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cnt integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_event_type not in ('create_case', 'upload', 'submit', 'withdraw', 'signed_url') then
    raise exception 'invalid event type';
  end if;
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit parameters';
  end if;

  select count(*)::integer into cnt
  from public.player_bgmi_ownership_rate_events e
  where e.player_id = uid
    and e.event_type = p_event_type
    and e.created_at > now() - make_interval(secs => p_window_seconds);

  if cnt >= p_limit then
    raise exception 'rate limit exceeded'
      using errcode = 'P0001';
  end if;

  insert into public.player_bgmi_ownership_rate_events (player_id, event_type)
  values (uid, p_event_type);
end;
$$;

revoke all on function public.assert_bgmi_ownership_rate_limit(text, integer, integer) from public;
grant execute on function public.assert_bgmi_ownership_rate_limit(text, integer, integer) to authenticated;

create or replace function public.submit_player_bgmi_ownership_case(p_case_id uuid)
returns public.player_bgmi_ownership_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  live_id text;
  row_out public.player_bgmi_ownership_cases;
  ev_count integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.app_users au where au.id = uid and au.status = 'active'
  ) then
    raise exception 'account not active';
  end if;

  select pgp.game_user_id into live_id
  from public.player_game_profiles pgp
  where pgp.player_user_id = uid and pgp.game_key = 'bgmi';

  if live_id is null or char_length(btrim(live_id)) < 4 then
    raise exception 'bgmi player id required';
  end if;

  select count(*)::integer into ev_count
  from public.player_bgmi_ownership_evidence e
  where e.case_id = p_case_id and e.player_id = uid;

  if ev_count < 1 or ev_count > 2 then
    raise exception 'evidence count invalid';
  end if;

  perform set_config('micronest.bgmi_ownership_allow_submit', '1', true);

  update public.player_bgmi_ownership_cases c
    set status = 'pending_review',
        claimed_game_user_id = live_id,
        identity_mismatch = false,
        submitted_at = now(),
        evidence_count = ev_count
    where c.id = p_case_id
      and c.player_id = uid
      and c.status = 'draft'
    returning * into row_out;

  if row_out.id is null then
    raise exception 'case not submittable';
  end if;

  return row_out;
end;
$$;

revoke all on function public.submit_player_bgmi_ownership_case(uuid) from public;
grant execute on function public.submit_player_bgmi_ownership_case(uuid) to authenticated;

create or replace function public.withdraw_player_bgmi_ownership_case(p_case_id uuid)
returns table (
  case_id uuid,
  storage_path text,
  already_withdrawn boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cur_status text;
  paths text[];
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select c.status into cur_status
  from public.player_bgmi_ownership_cases c
  where c.id = p_case_id and c.player_id = uid
  for update;

  if cur_status is null then
    raise exception 'case not found';
  end if;

  if cur_status = 'withdrawn' then
    -- Idempotent: no remaining paths.
    return;
  end if;

  if cur_status not in ('draft', 'pending_review', 'id_mismatch') then
    raise exception 'case not withdrawable';
  end if;

  select coalesce(array_agg(e.storage_path), '{}') into paths
  from public.player_bgmi_ownership_evidence e
  where e.case_id = p_case_id and e.player_id = uid;

  perform set_config('micronest.bgmi_ownership_allow_withdraw', '1', true);
  perform set_config('micronest.bgmi_ownership_allow_claim_clear', '1', true);

  -- Mark withdrawn first so Storage DELETE policy allows object removal.
  update public.player_bgmi_ownership_cases c
    set status = 'withdrawn',
        withdrawn_at = coalesce(c.withdrawn_at, now()),
        claimed_game_user_id = null,
        identity_mismatch = false,
        evidence_count = 0
    where c.id = p_case_id and c.player_id = uid;

  -- Delete evidence metadata (audit remains on case row timestamps/status).
  delete from public.player_bgmi_ownership_evidence e
  where e.case_id = p_case_id and e.player_id = uid;

  return query
    select p_case_id, p.path, false
    from unnest(paths) as p(path);
end;
$$;

revoke all on function public.withdraw_player_bgmi_ownership_case(uuid) from public;
grant execute on function public.withdraw_player_bgmi_ownership_case(uuid) to authenticated;

-- =============================================================================
-- 5. Storage helpers + policy replacement for private-verification
-- =============================================================================

create or replace function public.private_verification_is_bgmi_ownership_path(object_name text)
returns boolean
language sql
immutable
as $$
  select coalesce((storage.foldername(object_name))[2], '') = 'bgmi-ownership';
$$;

create or replace function public.private_verification_bgmi_case_id(object_name text)
returns uuid
language plpgsql
stable
as $$
declare
  raw text := (storage.foldername(object_name))[3];
begin
  if raw is null or raw !~ '^[0-9a-fA-F-]{36}$' then
    return null;
  end if;
  return raw::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.private_verification_can_insert_bgmi_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.player_bgmi_ownership_cases c
    where c.id = public.private_verification_bgmi_case_id(object_name)
      and c.player_id = auth.uid()
      and c.status = 'draft'
  );
$$;

create or replace function public.private_verification_can_delete_bgmi_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.player_bgmi_ownership_cases c
    where c.id = public.private_verification_bgmi_case_id(object_name)
      and c.player_id = auth.uid()
      and c.status in ('draft', 'withdrawn')
  );
$$;

revoke all on function public.private_verification_is_bgmi_ownership_path(text) from public;
revoke all on function public.private_verification_bgmi_case_id(text) from public;
revoke all on function public.private_verification_can_insert_bgmi_object(text) from public;
revoke all on function public.private_verification_can_delete_bgmi_object(text) from public;
grant execute on function public.private_verification_is_bgmi_ownership_path(text) to authenticated;
grant execute on function public.private_verification_bgmi_case_id(text) to authenticated;
grant execute on function public.private_verification_can_insert_bgmi_object(text) to authenticated;
grant execute on function public.private_verification_can_delete_bgmi_object(text) to authenticated;

drop policy if exists "private-verification owner insert" on storage.objects;
drop policy if exists "private-verification owner delete own pending" on storage.objects;

create policy "private-verification owner insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'private-verification'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (
    not public.private_verification_is_bgmi_ownership_path(name)
    or public.private_verification_can_insert_bgmi_object(name)
  )
);

-- Owner DELETE: non-bgmi paths keep folder ownership; bgmi-ownership paths
-- require case status draft or withdrawn (pending/id_mismatch blocked).
create policy "private-verification owner delete own pending"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'private-verification'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (
    not public.private_verification_is_bgmi_ownership_path(name)
    or public.private_verification_can_delete_bgmi_object(name)
  )
);

-- SELECT policy unchanged (owner folder read).
