-- MicroNest — Tie-Breaker Free tier: atomic monthly lock quota (RCCF-FREEMIUM-TIEBREAKER-IMPLEMENT-07)
--
-- Approved product: 3 locked official records per organization per
-- workspace-local calendar month (organizations.timezone). Drafts unlimited.
-- Paid / All Access bypass the quota. History/branding gating is enforced in
-- the application service layer; this migration provides the transactional
-- primitives plus the two billing/share adjustments Free requires.
--
-- What this migration does:
-- 1. Allows source='free' on public.tool_entitlements (org scope, Tie-Breaker
--    Free grants). Mirrors the user-grant precedent (20251023000001). No
--    Sponsorship behavior change: Sponsorship never reads org grants by
--    source, and has_tool_access is source-agnostic by prior design.
-- 2. consume_tie_breaker_lock(): atomic finalize + workspace-month quota in
--    one transaction, serialized per org + local month via
--    pg_advisory_xact_lock (transaction-scoped, PgBouncer-safe). Paid and
--    All Access short-circuit before the quota check. Already-locked rows
--    return idempotently with zero quota consumption. The record number is
--    allocated AFTER the quota check, so rejections leave no gaps.
-- 3. Lock-path guard: direct status→locked writes that bypass the RPC are
--    rejected (TBK01). The RPC authorizes itself with a transaction-local
--    marker. This closes the browser-write quota bypass without changing RLS.
-- 4. Covering partial index for the monthly locked-record count.
-- 5. complete_billing_payment: narrow Free→Paid org transition. An existing
--    source='free' org row becomes source='subscription' with finite paid
--    expiry on purchase (NULL-expiry free rows start from now(); they have no
--    paid history to extend). Non-free NULL rows keep FIX-05 preservation
--    byte-identical. Source='free' org rows cannot exist before this
--    migration (CHECK forbade them), so no existing row changes behavior.
--    Body is otherwise verbatim 20251024000001 (sponsor mirror + FIX-05 kept).
-- 6. get_completed_tie_breaker_share: organization logo is exposed only when
--    the org holds an unexpired paid Tie-Breaker / All Access grant (Free
--    branding is paid-only). All other share semantics unchanged.
--
-- What this migration does NOT do:
--   * No generic quota tables/counters, no user-level Tie-Breaker grants,
--     no history tables, no draft caps, no pricing/Razorpay change.
--   * No Sponsorship SQL change (consume_free_check untouched).
--   * No RLS change. No Creator/Agency tables.
--
-- Error contract (SQLSTATE → application mapping in tie-breaker-policy.ts):
--   TBF01 quota_exceeded — Free monthly budget exhausted. No row changed.
--   TBN01 no_access     — no membership, foreign/missing competition, no
--                         tool, or neither paid nor Free coverage.
--   TBD01 invalid       — competition is not lockable (must be active).
--   TBK01 lock_path     — direct write attempted to bypass the RPC.

-- ─────────────────────────────────────────────────────────────
-- 1. Allow source='free' on tool_entitlements (org scope)
-- ─────────────────────────────────────────────────────────────
alter table public.tool_entitlements
  drop constraint if exists tool_entitlements_source_check;

alter table public.tool_entitlements
  add constraint tool_entitlements_source_check
  check (source in ('subscription', 'manual', 'promo', 'free'));

-- ─────────────────────────────────────────────────────────────
-- 2. Covering index for the workspace-month locked count
-- ─────────────────────────────────────────────────────────────
create index if not exists tie_breaker_competitions_org_locked_idx
  on public.tie_breaker_competitions (organization_id, locked_at)
  where status = 'locked';

-- ─────────────────────────────────────────────────────────────
-- 3. Atomic lock + workspace-month quota reservation
-- ─────────────────────────────────────────────────────────────
create or replace function public.consume_tie_breaker_lock(
  p_organization_id uuid,
  p_competition_id uuid,
  p_user_id uuid,
  p_snapshot jsonb,
  p_locked_at timestamptz
)
returns public.tie_breaker_competitions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tool_id uuid;
  v_comp public.tie_breaker_competitions%rowtype;
  v_org_paid boolean := false;
  v_org_free boolean := false;
  v_tz text;
  v_month_key text;
  v_month_start timestamptz;
  v_used integer;
  v_ref text;
  v_locked_at timestamptz;
  v_snapshot jsonb;
begin
  -- STEP 1 — membership. Never trust the caller's assertion.
  if not exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = p_user_id
  ) then
    raise exception 'no_access: user is not a member of organization' using errcode = 'TBN01';
  end if;

  -- Tie-Breaker tool id (must exist and be commercially active).
  select id into v_tool_id from public.tools where slug = 'tie-breaker' and is_active = true;
  if not found then
    raise exception 'no_access: tie-breaker tool not available' using errcode = 'TBN01';
  end if;

  -- STEP 2 — lock the competition row. All later decisions in this
  -- transaction observe the same row state.
  select * into v_comp
  from public.tie_breaker_competitions
  where id = p_competition_id
  for update;
  if not found or v_comp.organization_id <> p_organization_id then
    raise exception 'no_access: competition not found in this workspace' using errcode = 'TBN01';
  end if;

  -- STEP 3 — idempotency: an already-locked record finalizes exactly once.
  -- Zero quota, zero record numbers, existing row returned.
  if v_comp.status = 'locked' then
    return v_comp;
  end if;

  -- Only active competitions may lock (mirrors assertTransition:
  -- draft→locked is rejected; review is a UI step over active rows).
  if v_comp.status <> 'active' then
    raise exception 'invalid: only active competitions can be locked' using errcode = 'TBD01';
  end if;

  -- STEP 4 — access level. Paid (per-tool or All Access, paid sources only)
  -- short-circuits with unlimited locks. Free requires a Free grant row.
  select exists (
    select 1 from public.tool_entitlements te
    where te.organization_id = p_organization_id
      and (te.expires_at is null or te.expires_at > now())
      and te.source in ('subscription', 'manual', 'promo')
      and (te.is_all_access = true
        or (te.is_all_access = false and te.tool_id = v_tool_id))
  ) into v_org_paid;

  if not v_org_paid then
    select exists (
      select 1 from public.tool_entitlements te
      where te.organization_id = p_organization_id
        and (te.expires_at is null or te.expires_at > now())
        and te.source = 'free'
        and (te.is_all_access = true
          or (te.is_all_access = false and te.tool_id = v_tool_id))
    ) into v_org_free;
    if not v_org_free then
      raise exception 'no_access: no tie-breaker coverage for this workspace' using errcode = 'TBN01';
    end if;
  end if;

  if v_org_free then
    -- STEP 5 — free lock: serialize per org + workspace-local month.
    -- The timezone is read from organizations (server-side, never caller
    -- input); the month boundary is timezone-aware (DST-safe).
    select timezone into v_tz
    from public.organizations
    where id = p_organization_id;
    if v_tz is null or not public.is_valid_iana_timezone(v_tz) then
      raise exception 'invalid: workspace timezone is not configured' using errcode = 'TBD01';
    end if;

    v_month_key := to_char(now() at time zone v_tz, 'YYYY-MM');
    perform pg_advisory_xact_lock(
      hashtext('tie_breaker_lock:' || p_organization_id::text),
      hashtext(v_month_key)
    );
    v_month_start := (date_trunc('month', now() at time zone v_tz)) at time zone v_tz;

    -- STEP 6 — budget: locked official records in this workspace whose
    -- lock timestamp falls in the current workspace-local month.
    -- 3/month (matches FREE_TIE_BREAKER_LOCKS_PER_MONTH; SQL cannot import
    -- the TS constant — change both together).
    select count(*) into v_used
    from public.tie_breaker_competitions
    where organization_id = p_organization_id
      and status = 'locked'
      and locked_at >= v_month_start;

    if v_used >= 3 then
      raise exception 'quota_exceeded: monthly free tie-breaker budget exhausted' using errcode = 'TBF01';
    end if;
  end if;

  -- STEP 7 — authorize this transaction for the lock-path guard, then
  -- allocate the record number AFTER the quota decision (rejections leave
  -- no numbering gaps) and finalize in the same guarded UPDATE.
  perform set_config('tie_breaker.authorized_lock', 'on', true);
  v_ref := public.tie_breaker_next_ref();
  v_locked_at := coalesce(p_locked_at, now());
  v_snapshot := coalesce(p_snapshot, '{}'::jsonb) || jsonb_build_object(
    'recordNumber', v_ref,
    'lockedAt', to_char(v_locked_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  update public.tie_breaker_competitions
  set status = 'locked',
      record_number = v_ref,
      locked_at = v_locked_at,
      locked_snapshot = v_snapshot
  where id = p_competition_id
    and status = 'active';

  if found then
    select * into v_comp
    from public.tie_breaker_competitions
    where id = p_competition_id;
    return v_comp;
  end if;

  -- Lost a concurrent race inside this transaction window: the winner's
  -- record is the official one (idempotent, no extra quota consumed here).
  select * into v_comp
  from public.tie_breaker_competitions
  where id = p_competition_id;
  return v_comp;
end;
$$;

-- Only service_role may execute (same precedent as consume_free_check).
-- All lock paths call through the server with the service-role client for
-- this RPC call only; reads stay on the RLS-aware caller client.
revoke all on function public.consume_tie_breaker_lock(uuid, uuid, uuid, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.consume_tie_breaker_lock(uuid, uuid, uuid, jsonb, timestamptz) to service_role;

comment on function public.consume_tie_breaker_lock(uuid, uuid, uuid, jsonb, timestamptz) is
'Atomic tie-breaker finalize: membership + coverage + workspace-month quota + record-number allocation + locked update in one transaction. Paid/All Access bypass quota. Already-locked rows return idempotently.';

-- ─────────────────────────────────────────────────────────────
-- 4. Lock-path guard: status→locked must finalize through the RPC
-- ─────────────────────────────────────────────────────────────
-- Direct writes (browser/REST, any role including service_role outside the
-- RPC transaction) cannot mint locked records and bypass the quota. The RPC
-- sets a transaction-local marker; each PostgREST statement runs in its own
-- transaction, so the marker can never leak across requests.
create or replace function public.tie_breaker_require_authorized_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.status is distinct from 'locked'
     and NEW.status = 'locked'
     and coalesce(current_setting('tie_breaker.authorized_lock', true), '') <> 'on'
  then
    raise exception 'tie-breaker locks must finalize through the official lock operation' using errcode = 'TBK01';
  end if;
  return NEW;
end;
$$;

drop trigger if exists tie_breaker_competitions_lock_path_guard on public.tie_breaker_competitions;
create trigger tie_breaker_competitions_lock_path_guard
  before update of status on public.tie_breaker_competitions
  for each row execute function public.tie_breaker_require_authorized_lock();

-- ─────────────────────────────────────────────────────────────
-- 5. complete_billing_payment: narrow Free→Paid org transition
-- ─────────────────────────────────────────────────────────────
-- Verbatim 20251024000001 body except the existing-entitlement branch:
-- a source='free' org row transitions to paid on purchase (it has no paid
-- history to extend, so a NULL-expiry free row starts from now()).
-- Non-free NULL rows keep FIX-05 infinite preservation byte-identical.
create or replace function public.complete_billing_payment(
  p_order_id uuid,
  p_razorpay_payment_id text,
  p_razorpay_signature text,
  p_amount_minor integer,
  p_currency text,
  p_verified_at timestamptz,
  p_billing_period text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_existing_payment public.payments%rowtype;
  v_existing_ent public.tool_entitlements%rowtype;
  v_new_expires_at timestamptz;
  v_is_all_access boolean;
  v_tool_id uuid;
  v_org_id uuid;
  v_existing_expires_at timestamptz;
  v_sponsor_tool_id uuid;
begin
  -- Lock order row
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found: %', p_order_id using errcode = 'P0002';
  end if;

  v_org_id := v_order.organization_id;
  v_is_all_access := v_order.is_all_access;
  v_tool_id := v_order.tool_id;

  -- Idempotency: if payment already exists for this razorpay_payment_id, return current state without re-extending
  select * into v_existing_payment from public.payments where razorpay_payment_id = p_razorpay_payment_id;
  if found then
    -- Return current entitlement expiry (do not extend again)
    if v_is_all_access then
      select expires_at into v_existing_expires_at from public.tool_entitlements
      where organization_id = v_org_id and is_all_access = true limit 1;
    elsif v_tool_id is not null then
      select expires_at into v_existing_expires_at from public.tool_entitlements
      where organization_id = v_org_id and tool_id = v_tool_id and is_all_access = false limit 1;
    else
      select expires_at into v_existing_expires_at from public.tool_entitlements
      where organization_id = v_org_id and is_all_access = v_is_all_access limit 1;
    end if;

    -- Sponsor mirror: align buyer user grant to current org expiry (no extension).
    -- Fenced to sponsor-sentinel; NULL buyer (historical orders) skips.
    -- Guarded on the org row existing: never invent access when the org
    -- entitlement itself is absent.
    -- Free-tier upgrade (FIX-05): an existing source='free' row transitions to
    -- source='subscription' WITH the paid expiry (the org leg's current
    -- expiry in this replay path). Non-free rows keep prior semantics:
    -- lifetime NULL rows are never shortened.
    if not v_is_all_access and v_tool_id is not null and v_order.buyer_user_id is not null then
      select id into v_sponsor_tool_id from public.tools where slug = 'sponsor-sentinel';
      if found and v_tool_id = v_sponsor_tool_id then
        perform 1 from public.tool_entitlements
        where organization_id = v_org_id and tool_id = v_tool_id and is_all_access = false;
        if found then
          insert into public.user_tool_entitlements (user_id, tool_id, source, expires_at)
          values (v_order.buyer_user_id, v_tool_id, 'subscription', v_existing_expires_at)
          on conflict (user_id, tool_id) do update set
            expires_at =
              case when public.user_tool_entitlements.source = 'free' then excluded.expires_at
                   when public.user_tool_entitlements.expires_at is null then null
                   else excluded.expires_at end,
            source =
              case when public.user_tool_entitlements.source = 'free' then 'subscription' else public.user_tool_entitlements.source end;
        end if;
      end if;
    end if;

    return jsonb_build_object(
      'order_id', v_order.id,
      'payment_id', v_existing_payment.id,
      'expires_at', v_existing_expires_at,
      'idempotent', true
    );
  end if;

  -- Insert payment
  insert into public.payments (order_id, organization_id, razorpay_payment_id, razorpay_signature, amount_minor, currency, status, verified_at)
  values (p_order_id, v_org_id, p_razorpay_payment_id, p_razorpay_signature, p_amount_minor, p_currency, 'captured', p_verified_at);

  -- Update order to paid
  update public.orders set status = 'paid', updated_at = now() where id = p_order_id;

  -- Handle entitlement: lock existing row if any
  if v_is_all_access then
    select * into v_existing_ent from public.tool_entitlements
    where organization_id = v_org_id and is_all_access = true for update;
  elsif v_tool_id is not null then
    select * into v_existing_ent from public.tool_entitlements
    where organization_id = v_org_id and tool_id = v_tool_id and is_all_access = false for update;
  else
    select * into v_existing_ent from public.tool_entitlements
    where organization_id = v_org_id and is_all_access = v_is_all_access for update;
  end if;

  if found then
    -- Existing entitlement found
    if v_existing_ent.expires_at is null and v_existing_ent.source is distinct from 'free' then
      -- Infinite/permanent paid/manual/promo (FIX-05) — MUST NOT downgrade
      -- to finite. Keep existing infinite, preserve access, record
      -- payment/order only. Do not update expires_at or source.
      v_new_expires_at := null;
    else
      -- Finite paid (renewal: max(existing, now) + period), or a Free grant
      -- upgrading to paid. A Free row has no paid history to extend: a
      -- NULL-expiry free row starts its paid term now().
      if p_billing_period = 'monthly' then
        v_new_expires_at := coalesce(greatest(v_existing_ent.expires_at, now()), now()) + interval '1 month';
      elsif p_billing_period = 'yearly' then
        v_new_expires_at := coalesce(greatest(v_existing_ent.expires_at, now()), now()) + interval '1 year';
      else
        raise exception 'Unknown billing_period: %', p_billing_period;
      end if;

      update public.tool_entitlements
      set expires_at = v_new_expires_at, source = 'subscription'
      where id = v_existing_ent.id;
    end if;
  else
    -- No existing entitlement — create new finite
    if p_billing_period = 'monthly' then
      v_new_expires_at := now() + interval '1 month';
    elsif p_billing_period = 'yearly' then
      v_new_expires_at := now() + interval '1 year';
    else
      raise exception 'Unknown billing_period: %', p_billing_period;
    end if;

    insert into public.tool_entitlements (organization_id, tool_id, is_all_access, source, expires_at)
    values (v_org_id, v_tool_id, v_is_all_access, 'subscription', v_new_expires_at);
  end if;

  -- Sponsor mirror: buyer user grant (same expiry value).
  -- Fenced to sponsor-sentinel only; NULL buyer (historical orders) skips.
  -- Idempotent via unique(user_id, tool_id).
  -- FIX-05: an existing source='free' row takes the computed paid expiry
  -- (v_new_expires_at); non-free lifetime (NULL) rows are never shortened.
  if not v_is_all_access and v_tool_id is not null and v_order.buyer_user_id is not null then
    select id into v_sponsor_tool_id from public.tools where slug = 'sponsor-sentinel';
    if found and v_tool_id = v_sponsor_tool_id then
      insert into public.user_tool_entitlements (user_id, tool_id, source, expires_at)
      values (v_order.buyer_user_id, v_tool_id, 'subscription', v_new_expires_at)
      on conflict (user_id, tool_id) do update set
        expires_at =
          case when public.user_tool_entitlements.source = 'free' then excluded.expires_at
               when public.user_tool_entitlements.expires_at is null then null
               else excluded.expires_at end,
        source =
          case when public.user_tool_entitlements.source = 'free' then 'subscription' else public.user_tool_entitlements.source end;
    end if;
  end if;

  -- Return new state
  select expires_at into v_existing_expires_at from public.tool_entitlements
  where (v_is_all_access and organization_id = v_org_id and is_all_access = true)
     or (not v_is_all_access and v_tool_id is not null and organization_id = v_org_id and tool_id = v_tool_id)
  limit 1;

  -- For infinite case, v_new_expires_at is null, so select will return null
  if v_new_expires_at is null then
    v_existing_expires_at := null;
  else
    -- Use the newly computed value for return (more precise than re-select for infinite)
    v_existing_expires_at := v_new_expires_at;
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'payment_id', v_existing_payment.id,
    'expires_at', v_existing_expires_at,
    'idempotent', false
  );

exception
  when others then
    raise;
end;
$$;

-- Only service_role should execute (bypasses RLS, but function is security definer)
revoke all on function public.complete_billing_payment(uuid, text, text, integer, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.complete_billing_payment(uuid, text, text, integer, text, timestamptz, text) to service_role;

-- ─────────────────────────────────────────────────────────────
-- 6. get_completed_tie_breaker_share: paid-only organization branding
-- ─────────────────────────────────────────────────────────────
-- Free official records share everything except custom branding. The logo is
-- exposed only when the workspace holds an unexpired paid Tie-Breaker (or
-- All Access) grant at share time. Draft exposure, token shape, allowlisted
-- fields, and anon/authenticated grants are unchanged.
create or replace function public.get_completed_tie_breaker_share(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'record_number', c.record_number,
    'competition_name', c.name,
    'description', c.description,
    'locked_at', c.locked_at,
    'rule_order', to_jsonb(c.rule_order),
    'scoring', jsonb_build_object(
      'win', c.scoring_win,
      'draw', c.scoring_draw,
      'loss', c.scoring_loss,
      'draws_enabled', c.draws_enabled,
      'round_label', c.round_label
    ),
    'snapshot', c.locked_snapshot,
    'organization_name', o.name,
    'organization_logo_url', case
      when exists (
        select 1 from public.tool_entitlements te
        left join public.tools t on t.id = te.tool_id
        where te.organization_id = c.organization_id
          and (te.expires_at is null or te.expires_at > now())
          and te.source in ('subscription', 'manual', 'promo')
          and (te.is_all_access = true
            or (te.is_all_access = false and t.slug = 'tie-breaker'))
      ) then o.logo_url
      else null
    end
  )
  from public.tie_breaker_competitions c
  join public.organizations o on o.id = c.organization_id
  where c.share_token = p_token
    and c.status = 'locked'
  limit 1;
$$;

revoke all on function public.get_completed_tie_breaker_share(uuid) from public;
grant execute on function public.get_completed_tie_breaker_share(uuid) to anon, authenticated;
