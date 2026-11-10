-- Prize Payout Tracker — Persistence Foundation (RCCF-PRIZE-PAYOUT-IMPLEMENTATION-02)
-- Tables: payout_trackers, payout_recipients + monthly publish ledger.
-- RLS: is_org_member(organization_id) for tenant tables; recipients inherit
-- via parent tracker. No anon table policy — public reads go through the
-- narrow SECURITY DEFINER share function only.
-- Public share: published/completed only, allowlisted fields, single record
-- by share_token. Only the last-4 reference is stored (never full UTR).
-- Publish quota: 1 published tracker per org per workspace-local month for
-- Free (organizations.timezone). Consumption is permanent: deleting a
-- published tracker does NOT restore the monthly slot. Paid / All Access
-- bypass the quota. Additive, deterministic, no secrets.
--
-- Error contract (SQLSTATE → application mapping in payout-tracker-policy.ts):
--   PTPQ01 quota_exceeded — Free monthly publish budget exhausted. No row changed.
--   PTPN01 no_access     — no membership, foreign/missing tracker, no tool, or
--                         neither paid nor Free coverage.
--   PTPD01 invalid       — tracker/recipient is not in a valid state for the
--                         requested operation (e.g. publish with no recipients).
--   PTPK01 publish_path  — direct status/share_token write attempted to bypass
--                         the official RPC operations.

-- ─────────────────────────────────────────────────────────────
-- payout_trackers
-- ─────────────────────────────────────────────────────────────
create table if not exists public.payout_trackers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  event_name text not null check (char_length(event_name) between 1 and 80),
  currency text not null check (currency in ('INR', 'USD', 'EUR', 'GBP')),
  deadline timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'completed')),
  share_token uuid not null unique default gen_random_uuid(),
  published_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_trackers_published_at_check check (
    (status in ('published', 'completed') and published_at is not null)
    or (status = 'draft')
  ),
  constraint payout_trackers_completed_at_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

drop trigger if exists payout_trackers_updated_at on public.payout_trackers;
create trigger payout_trackers_updated_at
  before update on public.payout_trackers
  for each row execute function public.handle_updated_at();

create index if not exists payout_trackers_org_status_idx on public.payout_trackers(organization_id, status, updated_at desc);
create index if not exists payout_trackers_share_token_idx on public.payout_trackers(share_token);

-- ─────────────────────────────────────────────────────────────
-- payout_recipients
-- ─────────────────────────────────────────────────────────────
create table if not exists public.payout_recipients (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references public.payout_trackers(id) on delete cascade,
  recipient_name text not null check (char_length(recipient_name) between 1 and 60),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 100000000000),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  reference_last4 text check (reference_last4 is null or reference_last4 ~ '^[A-Za-z0-9]{4}$'),
  proof_url text check (proof_url is null or (char_length(proof_url) <= 500 and proof_url like 'https://%')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_recipients_paid_at_check check (
    (status = 'paid' and paid_at is not null)
    or (status = 'pending' and paid_at is null)
  )
);

drop trigger if exists payout_recipients_updated_at on public.payout_recipients;
create trigger payout_recipients_updated_at
  before update on public.payout_recipients
  for each row execute function public.handle_updated_at();

create index if not exists payout_recipients_tracker_idx on public.payout_recipients(tracker_id, sort_order, created_at);

-- ─────────────────────────────────────────────────────────────
-- RLS — tenant tables (recipients inherit through parent tracker)
-- ─────────────────────────────────────────────────────────────
alter table public.payout_trackers enable row level security;
alter table public.payout_recipients enable row level security;

drop policy if exists payout_trackers_select_member on public.payout_trackers;
create policy payout_trackers_select_member on public.payout_trackers
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists payout_trackers_insert_member on public.payout_trackers;
create policy payout_trackers_insert_member on public.payout_trackers
  for insert to authenticated with check (public.is_org_member(organization_id));

drop policy if exists payout_trackers_update_member on public.payout_trackers;
create policy payout_trackers_update_member on public.payout_trackers
  for update to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists payout_trackers_delete_member on public.payout_trackers;
create policy payout_trackers_delete_member on public.payout_trackers
  for delete to authenticated using (public.is_org_member(organization_id));

drop policy if exists payout_recipients_select_member on public.payout_recipients;
create policy payout_recipients_select_member on public.payout_recipients
  for select to authenticated using (
    exists (
      select 1 from public.payout_trackers t
      where t.id = payout_recipients.tracker_id
        and public.is_org_member(t.organization_id)
    )
  );

drop policy if exists payout_recipients_insert_member on public.payout_recipients;
create policy payout_recipients_insert_member on public.payout_recipients
  for insert to authenticated with check (
    exists (
      select 1 from public.payout_trackers t
      where t.id = payout_recipients.tracker_id
        and public.is_org_member(t.organization_id)
    )
  );

drop policy if exists payout_recipients_update_member on public.payout_recipients;
create policy payout_recipients_update_member on public.payout_recipients
  for update to authenticated
  using (
    exists (
      select 1 from public.payout_trackers t
      where t.id = payout_recipients.tracker_id
        and public.is_org_member(t.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.payout_trackers t
      where t.id = payout_recipients.tracker_id
        and public.is_org_member(t.organization_id)
    )
  );

drop policy if exists payout_recipients_delete_member on public.payout_recipients;
create policy payout_recipients_delete_member on public.payout_recipients
  for delete to authenticated using (
    exists (
      select 1 from public.payout_trackers t
      where t.id = payout_recipients.tracker_id
        and public.is_org_member(t.organization_id)
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Publish-path guard: status / published_at / completed_at / share_token
-- must change through the official RPC operations below. Direct writes
-- (browser/REST, any role outside the RPC transaction) are rejected.
-- The RPCs authorize themselves with transaction-local markers.
-- ─────────────────────────────────────────────────────────────
create or replace function public.payout_tracker_require_authorized_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.status is distinct from NEW.status
      and coalesce(current_setting('payout_tracker.authorized_transition', true), '') <> 'on'
  then
    raise exception 'payout tracker status changes must go through the official publish operation' using errcode = 'PTPK01';
  end if;
  if (NEW.published_at is distinct from OLD.published_at
      or NEW.completed_at is distinct from OLD.completed_at)
      and coalesce(current_setting('payout_tracker.authorized_transition', true), '') <> 'on'
  then
    raise exception 'payout tracker timestamps are server-generated' using errcode = 'PTPK01';
  end if;
  if NEW.share_token is distinct from OLD.share_token
      and coalesce(current_setting('payout_tracker.authorized_rotation', true), '') <> 'on'
  then
    raise exception 'payout tracker share links must be revoked through the official revoke operation' using errcode = 'PTPK01';
  end if;
  return NEW;
end;
$$;

drop trigger if exists payout_trackers_transition_guard on public.payout_trackers;
create trigger payout_trackers_transition_guard
  before update of status, published_at, completed_at, share_token on public.payout_trackers
  for each row execute function public.payout_tracker_require_authorized_transition();

-- ─────────────────────────────────────────────────────────────
-- Monthly publish ledger (permanent consumption accounting)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.payout_tracker_monthly_publishes (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  month_key text not null check (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  tracker_id uuid not null,
  consumed_at timestamptz not null default now(),
  constraint payout_tracker_monthly_publishes_pkey primary key (organization_id, month_key, tracker_id)
);

-- The primary key prefix (organization_id, month_key) serves the monthly
-- budget lookup; no additional index is required.
-- tracker_id is deliberately NOT a foreign key: deleting a published tracker
-- must neither delete nor block on its consumption record.

alter table public.payout_tracker_monthly_publishes enable row level security;

-- ─────────────────────────────────────────────────────────────
-- Atomic publish + workspace-month quota reservation
-- ─────────────────────────────────────────────────────────────
create or replace function public.consume_payout_tracker_publish(
  p_org_id uuid,
  p_tracker_id uuid,
  p_user_id uuid
)
returns public.payout_trackers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tool_id uuid;
  v_tracker public.payout_trackers%rowtype;
  v_org_paid boolean := false;
  v_org_free boolean := false;
  v_tz text;
  v_month_key text;
  v_used integer;
  v_recipient_count integer;
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

  -- STEP 2 — lock the tracker row. All later decisions in this
  -- transaction observe the same row state.
  select * into v_tracker
  from public.payout_trackers
  where id = p_tracker_id
  for update;
  if not found or v_tracker.organization_id <> p_org_id then
    raise exception 'no_access: tracker not found in this workspace' using errcode = 'PTPN01';
  end if;

  -- STEP 3 — idempotency: an already-published record finalizes exactly once.
  -- Zero quota, zero ledger rows, existing row returned. Editing a published
  -- tracker never consumes quota — only new publications do.
  if v_tracker.status in ('published', 'completed') then
    return v_tracker;
  end if;

  -- Only drafts may publish (no unpublish workflow in V1).
  if v_tracker.status <> 'draft' then
    raise exception 'invalid: only draft trackers can be published' using errcode = 'PTPD01';
  end if;

  -- STEP 4 — access level. Paid (per-tool or All Access, paid sources only)
  -- short-circuits with unlimited publications and no ledger row. Free
  -- requires a Free grant row.
  select exists (
    select 1 from public.tool_entitlements te
    where te.organization_id = p_org_id
      and (te.expires_at is null or te.expires_at > now())
      and te.source in ('subscription', 'manual', 'promo')
      and (te.is_all_access = true
        or (te.is_all_access = false and te.tool_id = v_tool_id))
  ) into v_org_paid;

  if not v_org_paid then
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
  end if;

  -- STEP 5 — a published tracker must have at least one recipient.
  select count(*) into v_recipient_count
  from public.payout_recipients
  where tracker_id = p_tracker_id;
  if v_recipient_count < 1 then
    raise exception 'invalid: add at least one recipient before publishing' using errcode = 'PTPD01';
  end if;

  if v_org_free then
    -- STEP 6 — free publish: serialize per org + workspace-local month.
    select timezone into v_tz
    from public.organizations
    where id = p_org_id;
    if v_tz is null or not public.is_valid_iana_timezone(v_tz) then
      raise exception 'invalid: workspace timezone is not configured' using errcode = 'PTPD01';
    end if;

    v_month_key := to_char(now() at time zone v_tz, 'YYYY-MM');
    perform pg_advisory_xact_lock(
      hashtext('payout_tracker_publish:' || p_org_id::text),
      hashtext(v_month_key)
    );

    -- STEP 7 — budget: ledger rows (permanent consumption) in this
    -- workspace-local month. 1/month (matches
    -- FREE_PAYOUT_TRACKER_PUBLISHES_PER_MONTH; SQL cannot import the TS
    -- constant — change both together). Deleting a published tracker never
    -- removes its ledger row, so the slot stays consumed.
    select count(*) into v_used
    from public.payout_tracker_monthly_publishes
    where organization_id = p_org_id
      and month_key = v_month_key;

    if v_used >= 1 then
      raise exception 'quota_exceeded: monthly free payout-tracker budget exhausted' using errcode = 'PTPQ01';
    end if;

    -- STEP 8 — consume the slot. Same transaction as the guarded UPDATE
    -- below: if the transition fails, this insert rolls back.
    insert into public.payout_tracker_monthly_publishes (organization_id, month_key, tracker_id)
    values (p_org_id, v_month_key, p_tracker_id);
  end if;

  -- STEP 9 — authorize this transaction for the transition guard, then
  -- publish with the database clock (caller timestamps are never trusted).
  perform set_config('payout_tracker.authorized_transition', 'on', true);

  update public.payout_trackers
  set status = 'published',
      published_at = now()
  where id = p_tracker_id
    and organization_id = p_org_id
    and status = 'draft';

  if found then
    select * into v_tracker
    from public.payout_trackers
    where id = p_tracker_id;
    return v_tracker;
  end if;

  -- Lost a concurrent race inside this transaction window: the winner's
  -- record is the official one (idempotent, no extra quota consumed here).
  select * into v_tracker
  from public.payout_trackers
  where id = p_tracker_id;
  return v_tracker;
end;
$$;

revoke all on function public.consume_payout_tracker_publish(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_payout_tracker_publish(uuid, uuid, uuid) to service_role;

comment on function public.consume_payout_tracker_publish(uuid, uuid, uuid) is
'Atomic payout-tracker publish: membership + coverage + workspace-month ledger quota + guarded update in one transaction. Paid/All Access bypass quota with no ledger row. Already-published rows return idempotently.';

-- ─────────────────────────────────────────────────────────────
-- Atomic recipient-status mutation + completion derivation.
-- completed = every recipient currently paid. Reopening (any pending)
-- flips back to published. Single transaction, serialized on the tracker row.
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

comment on function public.apply_payout_recipient_status(uuid, uuid, uuid, text, uuid) is
'Atomic payout status toggle: membership + tracker lock + recipient update + published/completed derivation in one transaction.';

-- ─────────────────────────────────────────────────────────────
-- Recompute published/completed after add/edit/remove recipient.
-- Same derivation as above, without touching any recipient row.
-- ─────────────────────────────────────────────────────────────
create or replace function public.refresh_payout_tracker_status(
  p_org_id uuid,
  p_tracker_id uuid,
  p_user_id uuid
)
returns public.payout_trackers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tracker public.payout_trackers%rowtype;
  v_pending integer;
  v_total integer;
begin
  if not exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = p_user_id
  ) then
    raise exception 'no_access: user is not a member of organization' using errcode = 'PTPN01';
  end if;

  select * into v_tracker
  from public.payout_trackers
  where id = p_tracker_id
  for update;
  if not found or v_tracker.organization_id <> p_org_id then
    raise exception 'no_access: tracker not found in this workspace' using errcode = 'PTPN01';
  end if;

  -- Drafts never derive completion; only published/completed trackers do.
  if v_tracker.status not in ('published', 'completed') then
    return v_tracker;
  end if;

  select count(*) filter (where status = 'pending'), count(*)
  into v_pending, v_total
  from public.payout_recipients
  where tracker_id = p_tracker_id;

  perform set_config('payout_tracker.authorized_transition', 'on', true);

  -- A published tracker with zero recipients stays published (publish
  -- requires recipients, but later removals must not strand completion).
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

  select * into v_tracker
  from public.payout_trackers
  where id = p_tracker_id;
  return v_tracker;
end;
$$;

revoke all on function public.refresh_payout_tracker_status(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.refresh_payout_tracker_status(uuid, uuid, uuid) to service_role;

comment on function public.refresh_payout_tracker_status(uuid, uuid, uuid) is
'Atomic payout completion recompute after recipient add/edit/remove. Drafts untouched.';

-- ─────────────────────────────────────────────────────────────
-- Share-link revocation: rotate the token, preserving all tracker data.
-- Old URLs stop working immediately. Never consumes publish quota.
-- ─────────────────────────────────────────────────────────────
create or replace function public.rotate_payout_tracker_token(
  p_org_id uuid,
  p_tracker_id uuid,
  p_user_id uuid
)
returns public.payout_trackers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tracker public.payout_trackers%rowtype;
begin
  if not exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = p_user_id
  ) then
    raise exception 'no_access: user is not a member of organization' using errcode = 'PTPN01';
  end if;

  select * into v_tracker
  from public.payout_trackers
  where id = p_tracker_id
  for update;
  if not found or v_tracker.organization_id <> p_org_id then
    raise exception 'no_access: tracker not found in this workspace' using errcode = 'PTPN01';
  end if;

  perform set_config('payout_tracker.authorized_rotation', 'on', true);

  update public.payout_trackers
  set share_token = gen_random_uuid()
  where id = p_tracker_id
  returning * into v_tracker;
  return v_tracker;
end;
$$;

revoke all on function public.rotate_payout_tracker_token(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.rotate_payout_tracker_token(uuid, uuid, uuid) to service_role;

comment on function public.rotate_payout_tracker_token(uuid, uuid, uuid) is
'Revokes the public payout URL by rotating share_token. Data, statuses, and publish quota untouched.';

-- ─────────────────────────────────────────────────────────────
-- Public share: published/completed only, allowlisted fields, single
-- record by token. No anonymous table policy — this function is the
-- only public path. Never returns ids, membership, billing, or full
-- references (only reference_last4, which is all that is stored).
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
    'deadline', t.deadline,
    'status', t.status,
    'published_at', t.published_at,
    'completed_at', t.completed_at,
    'updated_at', t.updated_at,
    'organization_name', o.name,
    'recipients', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'recipient_name', r.recipient_name,
          'amount_minor', r.amount_minor,
          'status', r.status,
          'paid_at', r.paid_at,
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
