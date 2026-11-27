-- P15-M2B.4: Super-admin BGMI ownership review decisions + public status reader.
-- Project: Esports knniommcyyhbyiwljisk only. Never LMS.
-- Additive: decisions table, approve/reject RPC (atomic audit), public reader,
--           status CHECK expansion, ID-mismatch invalidates approved cases.
-- Does NOT widen frozen G1 12-field public projection RPCs.
-- Does NOT grant Storage SELECT to reviewers (signed URLs via service role after app authz).

-- =============================================================================
-- 1. Expand case statuses
-- =============================================================================

alter table public.player_bgmi_ownership_cases
  drop constraint if exists player_bgmi_ownership_cases_status_check;

alter table public.player_bgmi_ownership_cases
  add constraint player_bgmi_ownership_cases_status_check
  check (status in (
    'draft',
    'pending_review',
    'withdrawn',
    'id_mismatch',
    'approved',
    'rejected'
  ));

alter table public.player_bgmi_ownership_cases
  add column if not exists decided_at timestamptz null;

alter table public.player_bgmi_ownership_cases
  add column if not exists player_facing_message text null
    check (
      player_facing_message is null
      or char_length(player_facing_message) between 5 and 280
    );

-- =============================================================================
-- 2. Decisions table
-- =============================================================================

create table public.player_bgmi_ownership_decisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique
    references public.player_bgmi_ownership_cases (id) on delete cascade,
  player_id uuid not null references public.app_users (id) on delete cascade,
  reviewer_id uuid not null references public.app_users (id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected')),
  internal_reason text not null
    check (char_length(btrim(internal_reason)) between 5 and 500),
  player_facing_message text null
    check (
      player_facing_message is null
      or char_length(player_facing_message) between 5 and 280
    ),
  decided_at timestamptz not null default now(),
  constraint player_bgmi_ownership_decisions_not_self check (reviewer_id <> player_id),
  constraint player_bgmi_ownership_decisions_reject_msg_chk check (
    decision = 'approved'
    or player_facing_message is not null
  )
);

comment on table public.player_bgmi_ownership_decisions is
  'P15-M2B.4: immutable reviewer decisions for BGMI ownership cases. One decision per case.';

create index player_bgmi_ownership_decisions_reviewer_idx
  on public.player_bgmi_ownership_decisions (reviewer_id, decided_at desc);

alter table public.player_bgmi_ownership_cases
  add column if not exists decision_id uuid null
    references public.player_bgmi_ownership_decisions (id) on delete set null;

alter table public.player_bgmi_ownership_decisions enable row level security;

revoke all on table public.player_bgmi_ownership_decisions from public, anon, authenticated;

-- Super-admin read only (writes via SECURITY DEFINER RPC).
grant select on table public.player_bgmi_ownership_decisions to authenticated;

create policy player_bgmi_ownership_decisions_admin_select
on public.player_bgmi_ownership_decisions
for select
to authenticated
using (public.is_super_admin());

-- Owner may read own decision outcome fields via case row player_facing_message;
-- not the internal_reason column through this table.

-- =============================================================================
-- 3. Guard: allow approve/reject transitions via GUC
-- =============================================================================

create or replace function public.tg_player_bgmi_ownership_cases_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.claimed_game_user_id is not null
       and new.claimed_game_user_id is distinct from old.claimed_game_user_id then
      if coalesce(current_setting('micronest.bgmi_ownership_allow_claim_clear', true), '') <> '1' then
        raise exception 'claimed_game_user_id is immutable';
      end if;
    end if;

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

    if new.status = 'id_mismatch'
       and old.status is distinct from 'id_mismatch' then
      if coalesce(current_setting('micronest.bgmi_ownership_allow_id_mismatch', true), '') <> '1' then
        raise exception 'id_mismatch requires system flagger';
      end if;
    end if;

    if old.status = 'pending_review'
       and new.status in ('approved', 'rejected') then
      if coalesce(current_setting('micronest.bgmi_ownership_allow_decide', true), '') <> '1' then
        raise exception 'decision requires decide RPC';
      end if;
    end if;

    -- Terminal decisions are immutable except ID-mismatch invalidation of approved.
    if old.status in ('approved', 'rejected')
       and new.status is distinct from old.status then
      if not (
        old.status = 'approved'
        and new.status = 'id_mismatch'
        and coalesce(current_setting('micronest.bgmi_ownership_allow_id_mismatch', true), '') = '1'
      ) then
        raise exception 'decided cases are immutable';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Flag pending OR approved when live BGMI ID changes.
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
        and c.status in ('pending_review', 'approved')
        and c.claimed_game_user_id is distinct from new.game_user_id;
  end if;
  return new;
end;
$$;

-- =============================================================================
-- 4. Decide RPC (approve/reject) — atomic with admin_audit_logs
-- =============================================================================

create or replace function public.decide_player_bgmi_ownership_case(
  p_case_id uuid,
  p_decision text,
  p_internal_reason text,
  p_player_facing_message text default null
)
returns public.player_bgmi_ownership_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  live_id text;
  ev_count integer;
  case_row public.player_bgmi_ownership_cases;
  v_decision_id uuid;
  reason_clean text;
  facing_clean text;
  audit_action text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid decision';
  end if;

  reason_clean := btrim(coalesce(p_internal_reason, ''));
  if char_length(reason_clean) < 5 or char_length(reason_clean) > 500 then
    raise exception 'internal reason invalid';
  end if;

  if p_decision = 'rejected' then
    facing_clean := btrim(coalesce(p_player_facing_message, ''));
    if char_length(facing_clean) < 5 or char_length(facing_clean) > 280 then
      raise exception 'player facing message required';
    end if;
  else
    facing_clean := null;
  end if;

  select * into case_row
  from public.player_bgmi_ownership_cases c
  where c.id = p_case_id
  for update;

  if case_row.id is null then
    raise exception 'case not found';
  end if;

  if case_row.player_id = uid then
    raise exception 'cannot review own case';
  end if;

  if case_row.status <> 'pending_review' then
    raise exception 'case not pending';
  end if;

  if case_row.identity_mismatch or case_row.claimed_game_user_id is null then
    raise exception 'case not eligible';
  end if;

  select count(*)::integer into ev_count
  from public.player_bgmi_ownership_evidence e
  where e.case_id = p_case_id and e.player_id = case_row.player_id;

  if ev_count < 1 or ev_count > 2 then
    raise exception 'evidence count invalid';
  end if;

  if p_decision = 'approved' then
    select pgp.game_user_id into live_id
    from public.player_game_profiles pgp
    where pgp.player_user_id = case_row.player_id
      and pgp.game_key = 'bgmi';

    if live_id is null or live_id is distinct from case_row.claimed_game_user_id then
      raise exception 'identity mismatch';
    end if;
  end if;

  insert into public.player_bgmi_ownership_decisions (
    case_id,
    player_id,
    reviewer_id,
    decision,
    internal_reason,
    player_facing_message
  ) values (
    p_case_id,
    case_row.player_id,
    uid,
    p_decision,
    reason_clean,
    facing_clean
  )
  returning id into v_decision_id;

  perform set_config('micronest.bgmi_ownership_allow_decide', '1', true);

  update public.player_bgmi_ownership_cases c
    set status = p_decision,
        decision_id = v_decision_id,
        decided_at = now(),
        player_facing_message = facing_clean,
        identity_mismatch = false
    where c.id = p_case_id
      and c.status = 'pending_review'
    returning * into case_row;

  if case_row.id is null then
    raise exception 'concurrent decision conflict';
  end if;

  audit_action := case
    when p_decision = 'approved' then 'bgmi_ownership.approve'
    else 'bgmi_ownership.reject'
  end;

  insert into public.admin_audit_logs (
    actor_user_id,
    action,
    target_type,
    target_id,
    reason,
    after_state
  ) values (
    uid,
    audit_action,
    'bgmi_ownership_case',
    p_case_id,
    reason_clean,
    jsonb_build_object(
      'decision', p_decision,
      'player_id', case_row.player_id,
      'decision_id', v_decision_id,
      'evidence_count', ev_count
    )
  );

  return case_row;
end;
$$;

revoke all on function public.decide_player_bgmi_ownership_case(uuid, text, text, text) from public;
grant execute on function public.decide_player_bgmi_ownership_case(uuid, text, text, text) to authenticated;

comment on function public.decide_player_bgmi_ownership_case(uuid, text, text, text) is
  'P15-M2B.4: super-admin approve/reject with row lock, self-review ban, identity match on approve, atomic admin_audit_logs insert.';

-- =============================================================================
-- 5. Public reader (separate from frozen 12-field projection)
-- =============================================================================

create or replace function public.get_player_bgmi_ownership_public_status(p_handle text)
returns table (
  handle text,
  ownership_reviewed boolean,
  status_label text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  h text := lower(btrim(coalesce(p_handle, '')));
  pid uuid;
  live_id text;
  claim text;
  st text;
begin
  if h !~ '^[a-z0-9_]{3,20}$' then
    return;
  end if;

  select pp.user_id into pid
  from public.player_profiles pp
  join public.app_users au on au.id = pp.user_id
  where lower(pp.handle) = h
    and au.status = 'active'
    and pp.is_discoverable = true;

  if pid is null then
    return;
  end if;

  -- Completeness gate mirrors public directory visibility (M2B.1 helper).
  if not public.player_profile_is_complete(pid) then
    return;
  end if;

  select c.status, c.claimed_game_user_id
    into st, claim
  from public.player_bgmi_ownership_cases c
  where c.player_id = pid
    and c.status = 'approved'
  order by c.decided_at desc nulls last
  limit 1;

  if st is null or claim is null then
    return query select h, false, null::text;
    return;
  end if;

  select pgp.game_user_id into live_id
  from public.player_game_profiles pgp
  where pgp.player_user_id = pid and pgp.game_key = 'bgmi';

  if live_id is null or live_id is distinct from claim then
    return query select h, false, null::text;
    return;
  end if;

  return query
    select h, true, 'BGMI ownership evidence reviewed'::text;
end;
$$;

revoke all on function public.get_player_bgmi_ownership_public_status(text) from public;
grant execute on function public.get_player_bgmi_ownership_public_status(text) to anon, authenticated;

comment on function public.get_player_bgmi_ownership_public_status(text) is
  'P15-M2B.4: narrow public badge reader. No BGMI ID, evidence, reviewer, or pending/rejected exposure. Separate from frozen 12-field G1 projection.';

-- Reviewer queue helper: bounded pending list (super-admin only).
create or replace function public.list_pending_bgmi_ownership_cases(p_limit integer default 50)
returns table (
  case_id uuid,
  player_id uuid,
  handle text,
  display_name text,
  ign text,
  claimed_game_user_id text,
  submitted_at timestamptz,
  evidence_count integer,
  status text,
  identity_mismatch boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lim integer := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if auth.uid() is null or not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  return query
  select
    c.id,
    c.player_id,
    pp.handle,
    pp.display_name,
    pgp.ign,
    c.claimed_game_user_id,
    c.submitted_at,
    c.evidence_count,
    c.status,
    c.identity_mismatch
  from public.player_bgmi_ownership_cases c
  join public.player_profiles pp on pp.user_id = c.player_id
  left join public.player_game_profiles pgp
    on pgp.player_user_id = c.player_id and pgp.game_key = 'bgmi'
  where c.status = 'pending_review'
  order by c.submitted_at asc nulls last
  limit lim;
end;
$$;

revoke all on function public.list_pending_bgmi_ownership_cases(integer) from public;
grant execute on function public.list_pending_bgmi_ownership_cases(integer) to authenticated;
