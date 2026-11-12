-- Prize Payout Tracker — SQLSTATE compatibility (RCCF-PRIZE-PAYOUT-FIX-02 / F7)
-- Additive; applies cleanly on top of the live 20251103000001 (core) +
-- 20251103000002 (launch) + 20251104000001 (hardening). Never edits those
-- files. No secrets. No logic changes: every function body below is
-- identical to its live predecessor except the errcode literals.
--
-- PostgreSQL SQLSTATE codes must be exactly five characters. The original
-- six-character codes (PTPQ01/PTPN01/PTPD01/PTPK01) do not survive RAISE:
-- Postgres answers 42704 "unrecognized exception condition" and the message
-- is lost, so application mappers cannot distinguish quota / access /
-- invalid / guard failures. Guards still failed closed (writes rejected,
-- transactions rolled back); only diagnostics degraded.
--
-- Replacement mapping (meaning preserved):
--   PTPQ01 -> PTPQ1  publication quota exceeded
--   PTPN01 -> PTPN1  entitlement/access missing
--   PTPD01 -> PTPD1  invalid operation / recipient cap exceeded
--   PTPK01 -> PTPK1  payout tracker integrity/transition guard
--
-- Every currently-live payout function/trigger-function that raises is
-- re-issued here. Triggers themselves need no change (they reference these
-- functions by name). Tables, RLS, indexes, grants, and the public share
-- shape are untouched.

-- ─────────────────────────────────────────────────────────────
-- Transition guard (integrity code PTPK1)
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
    raise exception 'payout tracker status changes must go through the official publish operation' using errcode = 'PTPK1';
  end if;
  if (NEW.published_at is distinct from OLD.published_at
      or NEW.completed_at is distinct from OLD.completed_at)
      and coalesce(current_setting('payout_tracker.authorized_transition', true), '') <> 'on'
  then
    raise exception 'payout tracker timestamps are server-generated' using errcode = 'PTPK1';
  end if;
  if NEW.share_token is distinct from OLD.share_token
      and coalesce(current_setting('payout_tracker.authorized_rotation', true), '') <> 'on'
  then
    raise exception 'payout tracker share links must be revoked through the official revoke operation' using errcode = 'PTPK1';
  end if;
  return NEW;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Draft-only INSERT guard (five-character integrity code PTPK1)
-- ─────────────────────────────────────────────────────────────
create or replace function public.payout_tracker_require_draft_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status <> 'draft' then
    raise exception 'payout trackers must be created as drafts; publish through the official publish operation' using errcode = 'PTPK1';
  end if;
  if NEW.published_at is not null or NEW.completed_at is not null then
    raise exception 'payout tracker timestamps are server-generated' using errcode = 'PTPK1';
  end if;
  return NEW;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Recipient status/paid_at guard (five-character integrity code PTPK1)
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
    raise exception 'payout recipient status changes must go through the official status operation' using errcode = 'PTPK1';
  end if;
  return NEW;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Recipient pending-only INSERT guard (five-character integrity code PTPK1)
-- ─────────────────────────────────────────────────────────────
create or replace function public.payout_recipient_require_pending_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status <> 'pending' or NEW.paid_at is not null then
    raise exception 'payout recipients must be created as pending' using errcode = 'PTPK1';
  end if;
  return NEW;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- Atomic publish + workspace-month quota reservation
-- (five-character codes; logic identical)
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
    raise exception 'no_access: user is not a member of organization' using errcode = 'PTPN1';
  end if;

  -- Payout Tracker tool id (must exist and be commercially active).
  select id into v_tool_id from public.tools where slug = 'payout-tracker' and is_active = true;
  if not found then
    raise exception 'no_access: payout-tracker tool not available' using errcode = 'PTPN1';
  end if;

  -- STEP 2 — lock the tracker row. All later decisions in this
  -- transaction observe the same row state.
  select * into v_tracker
  from public.payout_trackers
  where id = p_tracker_id
  for update;
  if not found or v_tracker.organization_id <> p_org_id then
    raise exception 'no_access: tracker not found in this workspace' using errcode = 'PTPN1';
  end if;

  -- STEP 3 — idempotency: an already-published record finalizes exactly once.
  -- Zero quota, zero ledger rows, existing row returned. Editing a published
  -- tracker never consumes quota — only new publications do.
  if v_tracker.status in ('published', 'completed') then
    return v_tracker;
  end if;

  -- Only drafts may publish (no unpublish workflow in V1).
  if v_tracker.status <> 'draft' then
    raise exception 'invalid: only draft trackers can be published' using errcode = 'PTPD1';
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
      raise exception 'no_access: no payout-tracker coverage for this workspace' using errcode = 'PTPN1';
    end if;
  end if;

  -- STEP 5 — a published tracker must have at least one recipient.
  select count(*) into v_recipient_count
  from public.payout_recipients
  where tracker_id = p_tracker_id;
  if v_recipient_count < 1 then
    raise exception 'invalid: add at least one recipient before publishing' using errcode = 'PTPD1';
  end if;

  if v_org_free then
    -- STEP 6 — free publish: serialize per org + workspace-local month.
    select timezone into v_tz
    from public.organizations
    where id = p_org_id;
    if v_tz is null or not public.is_valid_iana_timezone(v_tz) then
      raise exception 'invalid: workspace timezone is not configured' using errcode = 'PTPD1';
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
      raise exception 'quota_exceeded: monthly free payout-tracker budget exhausted' using errcode = 'PTPQ1';
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
-- Atomic recipient-status mutation + completion derivation
-- (five-character codes; logic identical to hardening)
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
    raise exception 'invalid: unknown recipient status' using errcode = 'PTPD1';
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = p_user_id
  ) then
    raise exception 'no_access: user is not a member of organization' using errcode = 'PTPN1';
  end if;

  -- Lock the tracker first: completion derivation observes stable state.
  select * into v_tracker
  from public.payout_trackers
  where id = p_tracker_id
  for update;
  if not found or v_tracker.organization_id <> p_org_id then
    raise exception 'no_access: tracker not found in this workspace' using errcode = 'PTPN1';
  end if;

  -- Status toggles are meaningful only on published/completed trackers.
  if v_tracker.status not in ('published', 'completed') then
    raise exception 'invalid: publish the tracker before marking payouts' using errcode = 'PTPD1';
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
    raise exception 'no_access: recipient not found in this tracker' using errcode = 'PTPN1';
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
-- Recompute published/completed after add/edit/remove recipient
-- (five-character codes; logic identical)
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
    raise exception 'no_access: user is not a member of organization' using errcode = 'PTPN1';
  end if;

  select * into v_tracker
  from public.payout_trackers
  where id = p_tracker_id
  for update;
  if not found or v_tracker.organization_id <> p_org_id then
    raise exception 'no_access: tracker not found in this workspace' using errcode = 'PTPN1';
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
-- Share-link revocation (five-character codes; logic identical)
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
    raise exception 'no_access: user is not a member of organization' using errcode = 'PTPN1';
  end if;

  select * into v_tracker
  from public.payout_trackers
  where id = p_tracker_id
  for update;
  if not found or v_tracker.organization_id <> p_org_id then
    raise exception 'no_access: tracker not found in this workspace' using errcode = 'PTPN1';
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
-- Atomic recipient creation (five-character codes; identical)
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
    raise exception 'no_access: user is not a member of organization' using errcode = 'PTPN1';
  end if;

  -- Payout Tracker tool id (must exist and be commercially active).
  select id into v_tool_id from public.tools where slug = 'payout-tracker' and is_active = true;
  if not found then
    raise exception 'no_access: payout-tracker tool not available' using errcode = 'PTPN1';
  end if;

  -- STEP 2 — lock the tracker row. Cap evaluation and completion refresh
  -- below observe stable state; concurrent creates serialize here and on
  -- the advisory lock in STEP 4.
  select * into v_tracker
  from public.payout_trackers
  where id = p_tracker_id
  for update;
  if not found or v_tracker.organization_id <> p_org_id then
    raise exception 'no_access: tracker not found in this workspace' using errcode = 'PTPN1';
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
      raise exception 'no_access: no payout-tracker coverage for this workspace' using errcode = 'PTPN1';
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
    raise exception 'recipient_limit: tracker already holds the maximum recipients for this plan' using errcode = 'PTPD1';
  end if;

  -- STEP 5 — payload validation (service Zod schemas validate first; the
  -- database re-checks so direct RPC misuse cannot store invalid rows).
  if p_name is null or char_length(p_name) < 1 or char_length(p_name) > 60 then
    raise exception 'invalid: recipient name must be 1-60 characters' using errcode = 'PTPD1';
  end if;
  if p_amount_minor is null or p_amount_minor <= 0 or p_amount_minor > 100000000000 then
    raise exception 'invalid: recipient amount out of range' using errcode = 'PTPD1';
  end if;
  if p_reference_last4 is not null and p_reference_last4 !~ '^[A-Za-z0-9]{4}$' then
    raise exception 'invalid: reference must be exactly the last 4 characters' using errcode = 'PTPD1';
  end if;
  if p_proof_url is not null and (char_length(p_proof_url) > 500 or p_proof_url not like 'https://%') then
    raise exception 'invalid: proof link must use https' using errcode = 'PTPD1';
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
