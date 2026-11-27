-- MicroNest — Dodo Payments provider columns + completion RPC.
--
-- V1 model: one-time Dodo checkout per billing period (parity with the
-- existing manual-renewal model). No auto-renewing subscriptions.
--
-- Razorpay columns/records stay intact as history/fallback for one release
-- cycle. New purchases write the dodo_* columns; the provider column marks
-- which provider fulfilled each order. The canonical entitlement math
-- (complete_billing_payment) is mirrored verbatim for Dodo — no parallel
-- entitlement engine, same expiry/All Access/free-upgrade semantics.
--
-- DO NOT APPLY AUTOMATICALLY. Apply via the standard migration workflow.

-- ── orders: provider discriminator + Dodo session reference ─────
alter table public.orders
  add column if not exists provider text not null default 'razorpay'
    constraint orders_provider_check check (provider in ('razorpay', 'dodo'));

alter table public.orders
  add column if not exists dodo_session_id text;

-- Partial unique: Dodo checkout session IDs are unique when present.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_dodo_session_unique') then
    alter table public.orders add constraint orders_dodo_session_unique unique (dodo_session_id);
  end if;
end $$;

-- Backfill guard: razorpay_order_id stays nullable for Dodo orders, but a
-- Dodo order must always carry its checkout session reference.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_dodo_session_present_check') then
    alter table public.orders add constraint orders_dodo_session_present_check
      check (provider <> 'dodo' or dodo_session_id is not null);
  end if;
end $$;

comment on column public.orders.provider is 'Fulfilling provider: razorpay (historical/active fallback) or dodo (V1 one-time checkout).';
comment on column public.orders.dodo_session_id is 'Dodo checkout session id (cks_*) for dodo orders; null for razorpay orders.';

-- ── payments: Dodo transaction reference ─────────────────────────
alter table public.payments
  add column if not exists dodo_payment_id text;

alter table public.payments
  add column if not exists dodo_signature text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_dodo_payment_unique') then
    alter table public.payments add constraint payments_dodo_payment_unique unique (dodo_payment_id);
  end if;
end $$;

comment on column public.payments.dodo_payment_id is 'Dodo payment id (pay_*) for dodo payments; null for razorpay payments.';
comment on column public.payments.dodo_signature is 'Dodo webhook signature (audit trail); null for razorpay payments and non-webhook completions.';

-- ── webhook_events: no change (generic provider/provider_event_id already covers dodo) ──

-- ── complete_dodo_payment: Dodo variant of the canonical completion ─
-- Mirrors public.complete_billing_payment (20251027000001, incl. Free→paid
-- upgrade and infinite-preservation semantics) with dodo_* columns.
-- Order/payment/entitlement math is identical; only the provider
-- identifier columns differ. service_role only.
create or replace function public.complete_dodo_payment(
  p_order_id uuid,
  p_dodo_payment_id text,
  p_dodo_signature text,
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

  if v_order.provider is distinct from 'dodo' then
    raise exception 'Order is not a Dodo order: %', p_order_id using errcode = 'P0001';
  end if;

  v_org_id := v_order.organization_id;
  v_is_all_access := v_order.is_all_access;
  v_tool_id := v_order.tool_id;

  -- Idempotency: if payment already exists for this dodo_payment_id, return current state without re-extending
  select * into v_existing_payment from public.payments where dodo_payment_id = p_dodo_payment_id;
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
    -- Free-tier upgrade: an existing source='free' row transitions to
    -- source='subscription' WITH the paid expiry. Non-free rows keep prior
    -- semantics: lifetime NULL rows are never shortened.
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
  insert into public.payments (order_id, organization_id, dodo_payment_id, dodo_signature, amount_minor, currency, status, verified_at)
  values (p_order_id, v_org_id, p_dodo_payment_id, p_dodo_signature, p_amount_minor, p_currency, 'captured', p_verified_at);

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
      -- Infinite/permanent paid/manual/promo — MUST NOT downgrade
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
revoke all on function public.complete_dodo_payment(uuid, text, text, integer, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.complete_dodo_payment(uuid, text, text, integer, text, timestamptz, text) to service_role;

comment on function public.complete_dodo_payment(uuid, text, text, integer, text, timestamptz, text) is 'Dodo variant of complete_billing_payment: identical entitlement math, dodo_* identifier columns. V1 one-time checkout per billing period.';

-- ── repair_billing_completion: accept Dodo provider payments ─────
-- Byte-identical to 20251108000001 except the provider-ID guard, which now
-- accepts either a Razorpay or a Dodo payment reference.
create or replace function public.repair_billing_completion(
  p_payment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_existing_ent public.tool_entitlements%rowtype;
  v_billing_period text;
  v_new_expires_at timestamptz;
  v_is_all_access boolean;
  v_tool_id uuid;
  v_org_id uuid;
  v_existing_expires_at timestamptz;
  v_sponsor_tool_id uuid;
begin
  -- Lock the existing payment row (never insert a second payment)
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found: %', p_payment_id using errcode = 'P0002';
  end if;

  -- Genuinely captured/authorized per the provider state model
  if v_payment.status is distinct from 'captured' and v_payment.status is distinct from 'authorized' then
    raise exception 'Payment is not eligible for repair (status: %)', v_payment.status using errcode = 'P0001';
  end if;
  if v_payment.razorpay_payment_id is null and v_payment.dodo_payment_id is null then
    raise exception 'Payment has no provider payment ID' using errcode = 'P0001';
  end if;

  -- Lock the linked order row
  select * into v_order from public.orders where id = v_payment.order_id for update;
  if not found then
    raise exception 'Linked order not found: %', v_payment.order_id using errcode = 'P0002';
  end if;

  -- Cross-org invariant: matching amount/currency alone is insufficient
  if v_payment.organization_id is distinct from v_order.organization_id then
    raise exception 'Payment/order organization mismatch' using errcode = 'P0001';
  end if;
  if v_payment.amount_minor is distinct from v_order.amount_minor
     or v_payment.currency is distinct from v_order.currency then
    raise exception 'Payment/order amount mismatch' using errcode = 'P0001';
  end if;

  v_org_id := v_order.organization_id;
  v_is_all_access := v_order.is_all_access;
  v_tool_id := v_order.tool_id;

  -- Billing period comes from the order's plan, never client input
  select billing_period into v_billing_period from public.plans where id = v_order.plan_id;
  if not found then
    raise exception 'Plan not found for order: %', v_order.id using errcode = 'P0002';
  end if;
  if v_billing_period is distinct from 'monthly' and v_billing_period is distinct from 'yearly' then
    raise exception 'Unknown billing_period: %', v_billing_period;
  end if;

  -- Idempotency: order already paid → return current state without re-extending
  if v_order.status = 'paid' then
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
      'payment_id', v_payment.id,
      'expires_at', v_existing_expires_at,
      'order_status', v_order.status,
      'idempotent', true
    );
  end if;

  -- Repair: flip the order to paid (no payment insert — the row exists)
  update public.orders set status = 'paid', updated_at = now() where id = v_order.id;

  -- Stamp verification time if absent (informational only; money state untouched)
  update public.payments
  set verified_at = coalesce(verified_at, now())
  where id = v_payment.id;

  -- Entitlement handling — mirrored from complete_billing_payment
  -- (20251027000001, incl. Free→paid upgrade semantics). Lock existing row.
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
      -- Infinite/permanent paid/manual/promo — MUST NOT downgrade to finite.
      v_new_expires_at := null;
    else
      -- Finite paid (renewal: max(existing, now) + period), or a Free grant
      -- upgrading to paid. A Free row has no paid history to extend: a
      -- NULL-expiry free row starts its paid term now().
      if v_billing_period = 'monthly' then
        v_new_expires_at := coalesce(greatest(v_existing_ent.expires_at, now()), now()) + interval '1 month';
      elsif v_billing_period = 'yearly' then
        v_new_expires_at := coalesce(greatest(v_existing_ent.expires_at, now()), now()) + interval '1 year';
      else
        raise exception 'Unknown billing_period: %', v_billing_period;
      end if;

      update public.tool_entitlements
      set expires_at = v_new_expires_at, source = 'subscription'
      where id = v_existing_ent.id;
    end if;
  else
    -- No existing entitlement — create new finite
    if v_billing_period = 'monthly' then
      v_new_expires_at := now() + interval '1 month';
    elsif v_billing_period = 'yearly' then
      v_new_expires_at := now() + interval '1 year';
    else
      raise exception 'Unknown billing_period: %', v_billing_period;
    end if;

    insert into public.tool_entitlements (organization_id, tool_id, is_all_access, source, expires_at)
    values (v_org_id, v_tool_id, v_is_all_access, 'subscription', v_new_expires_at);
  end if;

  -- Sponsor mirror: buyer user grant (same expiry value).
  -- Fenced to sponsor-sentinel only; NULL buyer (historical orders) skips.
  -- Idempotent via unique(user_id, tool_id); free rows take the paid expiry,
  -- non-free lifetime (NULL) rows are never shortened.
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

  if v_new_expires_at is null then
    v_existing_expires_at := null;
  else
    v_existing_expires_at := v_new_expires_at;
  end if;

  return jsonb_build_object(
    'order_id', v_order.id,
    'payment_id', v_payment.id,
    'expires_at', v_existing_expires_at,
    'order_status', 'paid',
    'idempotent', false
  );

exception
  when others then
    raise;
end;
$$;

-- Only service_role may execute (same precedent as complete_billing_payment)
revoke all on function public.repair_billing_completion(uuid) from public, anon, authenticated;
grant execute on function public.repair_billing_completion(uuid) to service_role;

comment on function public.repair_billing_completion(uuid) is 'Superadmin repair for captured/authorized payments whose order is not paid. Accepts Razorpay or Dodo provider payments. Locks existing rows, validates linkage server-side, never inserts a second payment. Idempotent when already paid.';
