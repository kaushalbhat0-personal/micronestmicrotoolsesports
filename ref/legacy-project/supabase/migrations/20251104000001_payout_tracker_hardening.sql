-- Prize Payout Tracker — Hardening (RCCF-PRIZE-PAYOUT-FIX-01)
-- Additive; applies cleanly on top of the live 20251103000001 (core) +
-- 20251103000002 (launch). Never edits those files. No secrets.
--
-- F1 — draft-only direct INSERT: a tracker may only be inserted in DRAFT
--   state (no manufactured status/published_at/completed_at). Publication
--   stays exclusively on consume_payout_tracker_publish.
-- F2 — recipient status/paid_at may only change through
--   apply_payout_recipient_status (transaction-local marker, same convention
--   as payout_trackers_transition_guard). Direct REST writes are rejected.
--   Recipient INSERTs must always be pending (the create RPC complies).
-- F3 — atomic recipient creation with tracker-scoped advisory lock + cap
--   (free 20 / paid 200) in one transaction.
-- F4 — public share returns day-granular dates only (PostgreSQL date, no
--   time/timezone precision).
--
-- Error contract additions (same SQLSTATE convention as core):
--   PTPK01 publish_path — direct status/share_token/timestamp write outside
--                         the official RPC operations (now also INSERT paths).
--   PTPD01 invalid     — extended: recipient cap reached, invalid recipient
--                         payload for the create RPC.

-- ─────────────────────────────────────────────────────────────
-- F1 — draft-only INSERT guard on payout_trackers
-- ─────────────────────────────────────────────────────────────
create or replace function public.payout_tracker_require_draft_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status <> 'draft' then
    raise exception 'payout trackers must be created as drafts; publish through the official publish operation' using errcode = 'PTPK01';
  end if;
  if NEW.published_at is not null or NEW.completed_at is not null then
    raise exception 'payout tracker timestamps are server-generated' using errcode = 'PTPK01';
  end if;
  return NEW;
end;
$$;

drop trigger if exists payout_trackers_draft_insert on public.payout_trackers;
create trigger payout_trackers_draft_insert
  before insert on public.payout_trackers
  for each row execute function public.payout_tracker_require_draft_insert();

-- ─────────────────────────────────────────────────────────────
-- F2 — recipient status/paid_at guard (marker convention)
-- ─────────────────────────────────────────────────────────────
create or replace function public.payout_recipient_require_authorized_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (OLD.status is distinct from NEW.status
      or OLD.paid_at is distinct from NEW.paid_at)
      and coalesce(current_setting('payout_tracker.authorized_recipient_status', true), '') <> 'on'
  then
    raise exception 'payout recipient status changes must go through the official status operation' using errcode = 'PTPK01';
  end if;
  return NEW;
end;
$$;

drop trigger if exists payout_recipients_status_guard on public.payout_recipients;
create trigger payout_recipients_status_guard
  before update of status, paid_at on public.payout_recipients
  for each row execute function public.payout_recipient_require_authorized_status();

-- Recipient rows always enter as pending; paid state is only reachable
-- through apply_payout_recipient_status. The create RPC below complies.
create or replace function public.payout_recipient_require_pending_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status <> 'pending' or NEW.paid_at is not null then
    raise exception 'payout recipients must be created as pending' using errcode = 'PTPK01';
  end if;
  return NEW;
end;
$$;

drop trigger if exists payout_recipients_pending_insert on public.payout_recipients;
create trigger payout_recipients_pending_insert
  before insert on public.payout_recipients
  for each row execute function public.payout_recipient_require_pending_insert();

-- ─────────────────────────────────────────────────────────────
-- F2 — authorize apply_payout_recipient_status for the status guard.
-- Body is otherwise byte-identical to the 20251103000001 definition;
-- only the authorized_recipient_status marker line is added.
-- ─────────────────────────────────────────────────────────────
create or replace function public.apply_payout_recipient_status(
  p_org_id uuid,
  p_tracker_id uuid,
  p_recipient_id uuid,
  p_status text,
  p_user_id uuid
)
returns public.payout_recipients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tracker public.payout_trackers%rowtype;
  v_recipient public.payout_recipients%rowtype;
  v_pending integer;
  v_total integer;
begin
  if p_status not in ('pending', 'paid') then
    raise exception 'invalid: unknown recipient status' using errcode = 'PTPD01';
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = p_user_id
  ) then
    raise exception 'no_access: user is not a member of organization' using errcode = 'PTPN01';
  end if;

  -- Lock the tracker first: completion derivation observes stable state.
  select * into v_tracker
  from public.payout_trackers
  where id = p_tracker_id
  for update;
  if not found or v_tracker.organization_id <> p_org_id then
    raise exception 'no_access: tracker not found in this workspace' using errcode = 'PTPN01';
  end if;

  -- Status toggles are meaningful only on published/completed trackers.
  if v_tracker.status not in ('published', 'completed') then
    raise exception 'invalid: publish the tracker before marking payouts' using errcode = 'PTPD01';
  end if;

  -- Authorize this transaction for the recipient status guard, then apply
  -- the toggle with the database clock (caller timestamps are never trusted).
  perform set_config('payout_tracker.authorized_recipient_status', 'on', true);

  update public.payout_recipients
  set status = p_status,
      paid_at = case when p_status = 'paid' then now() else null end
  where id = p_recipient_id
    and tracker_id = p_tracker_id
  returning * into v_recipient;
  if not found then
    raise exception 'no_access: recipient not found in this tracker' using errcode = 'PTPN01';
  end if;

  select count(*) filter (where status = 'pending'), count(*)
  into v_pending, v_total
  from public.payout_recipients
  where tracker_id = p_tracker_id;

  perform set_config('payout_tracker.authorized_transition', 'on', true);

  if v_total > 0 and v_pending = 0 then
    update public.payout_trackers
    set status = 'completed',
        completed_at = coalesce(completed_at, now())
    where id = p_tracker_id;
  else
    update public.payout_trackers
    set status = 'published',
        completed_at = null
    where id = p_tracker_id;
  end if;

  return v_recipient;
end;
$$;

revoke all on function public.apply_payout_recipient_status(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.apply_payout_recipient_status(uuid, uuid, uuid, text, uuid) to service_role;

-- ─────────────────────────────────────────────────────────────
-- F3 — atomic recipient creation: membership + ownership + coverage +
-- tracker-scoped advisory lock + cap + insert + live-status refresh in one
-- transaction. Concurrent adds to the same tracker serialize on the lock,
-- so the cap (free 20 / paid 200) holds under concurrency.
-- ─────────────────────────────────────────────────────────────
create or replace function public.create_payout_recipient(
  p_org_id uuid,
  p_tracker_id uuid,
  p_user_id uuid,
  p_name text,
  p_amount_minor bigint,
  p_reference_last4 text,
  p_proof_url text
)
returns public.payout_recipients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tool_id uuid;
  v_tracker public.payout_trackers%rowtype;
  v_org_paid boolean := false;
  v_org_free boolean := false;
  v_max integer;
  v_count integer;
  v_recipient public.payout_recipients%rowtype;
  v_pending integer;
  v_total integer;
begin
  -- STEP 1 — membership. Never trust the caller's assertion.
  if not exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = p_user_id
  ) then
    raise exception 'no_access: user is not a member of organization' using errcode = 'PTPN01';
  end if;

  -- Payout Tracker tool id (must exist and be commercially active).
  select id into v_tool_id from public.tools where slug = 'payout-tracker' and is_active = true;
  if not found then
    raise exception 'no_access: payout-tracker tool not available' using errcode = 'PTPN01';
  end if;

  -- STEP 2 — lock the tracker row. Cap evaluation and completion refresh
  -- below observe stable state; concurrent creates serialize here and on
  -- the advisory lock in STEP 4.
  select * into v_tracker
  from public.payout_trackers
  where id = p_tracker_id
  for update;
  if not found or v_tracker.organization_id <> p_org_id then
    raise exception 'no_access: tracker not found in this workspace' using errcode = 'PTPN01';
  end if;

  -- STEP 3 — access level. Paid (per-tool or All Access, paid sources only)
  -- allows 200 recipients; Free requires a Free grant row and allows 20.
  -- (Mirrors recipientsMaxForLevel in payout-tracker-policy.ts — change both
  -- together.) No coverage means no creation.
  select exists (
    select 1 from public.tool_entitlements te
    where te.organization_id = p_org_id
      and (te.expires_at is null or te.expires_at > now())
      and te.source in ('subscription', 'manual', 'promo')
      and (te.is_all_access = true
        or (te.is_all_access = false and te.tool_id = v_tool_id))
  ) into v_org_paid;

  if v_org_paid then
    v_max := 200;
  else
    select exists (
      select 1 from public.tool_entitlements te
      where te.organization_id = p_org_id
        and (te.expires_at is null or te.expires_at > now())
        and te.source = 'free'
        and (te.is_all_access = true
          or (te.is_all_access = false and te.tool_id = v_tool_id))
    ) into v_org_free;
    if not v_org_free then
      raise exception 'no_access: no payout-tracker coverage for this workspace' using errcode = 'PTPN01';
    end if;
    v_max := 20;
  end if;

  -- STEP 4 — serialize cap evaluation + insert per tracker. Concurrent
  -- creates observe each other's committed inserts through the row lock
  -- above and never interleave inside this critical section.
  perform pg_advisory_xact_lock(hashtext('payout_tracker_recipients:' || p_tracker_id::text));

  select count(*) into v_count
  from public.payout_recipients
  where tracker_id = p_tracker_id;
  if v_count >= v_max then
    raise exception 'recipient_limit: tracker already holds the maximum recipients for this plan' using errcode = 'PTPD01';
  end if;

  -- STEP 5 — payload validation (service Zod schemas validate first; the
  -- database re-checks so direct RPC misuse cannot store invalid rows).
  if p_name is null or char_length(p_name) < 1 or char_length(p_name) > 60 then
    raise exception 'invalid: recipient name must be 1-60 characters' using errcode = 'PTPD01';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > 100000000000 then
    raise exception 'invalid: recipient amount out of range' using errcode = 'PTPD01';
  end if;
  if p_reference_last4 is not null and p_reference_last4 !~ '^[A-Za-z0-9]{4}$' then
    raise exception 'invalid: reference must be exactly the last 4 characters' using errcode = 'PTPD01';
  end if;
  if p_proof_url is not null and (char_length(p_proof_url) > 500 or p_proof_url not like 'https://%') then
    raise exception 'invalid: proof link must use https' using errcode = 'PTPD01';
  end if;

  insert into public.payout_recipients
    (tracker_id, recipient_name, amount_minor, status, paid_at, reference_last4, proof_url, sort_order)
  values
    (p_tracker_id, p_name, p_amount_minor, 'pending', null, nullif(p_reference_last4, ''), nullif(p_proof_url, ''), v_count)
  returning * into v_recipient;

  -- STEP 6 — live trackers recompute published/completed in the same
  -- transaction (same derivation as refresh_payout_tracker_status; drafts
  -- never derive completion).
  if v_tracker.status in ('published', 'completed') then
    select count(*) filter (where status = 'pending'), count(*)
    into v_pending, v_total
    from public.payout_recipients
    where tracker_id = p_tracker_id;

    perform set_config('payout_tracker.authorized_transition', 'on', true);

    if v_total > 0 and v_pending = 0 then
      update public.payout_trackers
      set status = 'completed',
          completed_at = coalesce(completed_at, now())
      where id = p_tracker_id;
    else
      update public.payout_trackers
      set status = 'published',
          completed_at = null
      where id = p_tracker_id;
    end if;
  end if;

  return v_recipient;
end;
$$;

revoke all on function public.create_payout_recipient(uuid, uuid, uuid, text, bigint, text, text) from public, anon, authenticated;
grant execute on function public.create_payout_recipient(uuid, uuid, uuid, text, bigint, text, text) to service_role;

comment on function public.create_payout_recipient(uuid, uuid, uuid, text, bigint, text, text) is
'Atomic payout recipient creation: membership + ownership + coverage + tracker-scoped advisory lock + cap + insert + live-status refresh in one transaction.';

-- ─────────────────────────────────────────────────────────────
-- F4 — public share at day granularity. Same allowlist and shape as the
-- 20251103000001 definition; every timestamp is cast to date so no
-- time/timezone precision leaves the database.
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_published_payout_tracker(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'event_name', t.event_name,
    'currency', t.currency,
    'deadline', (t.deadline::date),
    'status', t.status,
    'published_at', (t.published_at::date),
    'completed_at', (t.completed_at::date),
    'updated_at', (t.updated_at::date),
    'organization_name', o.name,
    'recipients', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'recipient_name', r.recipient_name,
          'amount_minor', r.amount_minor,
          'status', r.status,
          'paid_at', (r.paid_at::date),
          'reference_last4', r.reference_last4,
          'proof_url', r.proof_url
        )
        order by r.sort_order, r.created_at
      )
      from public.payout_recipients r
      where r.tracker_id = t.id
    ), '[]'::jsonb)
  )
  from public.payout_trackers t
  join public.organizations o on o.id = t.organization_id
  where t.share_token = p_token
    and t.status in ('published', 'completed')
  limit 1;
$$;

revoke all on function public.get_published_payout_tracker(uuid) from public;
grant execute on function public.get_published_payout_tracker(uuid) to anon, authenticated, service_role;
