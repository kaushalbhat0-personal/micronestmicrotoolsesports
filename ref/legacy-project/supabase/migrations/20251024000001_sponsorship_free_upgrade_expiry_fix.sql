-- MicroNest — Sponsorship free → paid expiry correction (RCCF-FIX-05, P0)
--
-- Corrects a billing defect in 20251023000001_sponsorship_free_tier.sql:
-- a Free grant (source='free', expires_at=NULL) converted by a paid purchase
-- kept expires_at=NULL while flipping source to 'subscription', minting a
-- lifetime paid user grant. The conflict logic preserved NULL unconditionally.
--
-- Corrected behavior (both the fresh path and the idempotent replay path):
--   IF existing source = 'free':
--     source = 'subscription'
--     expires_at = calculated paid expiry (the same value already computed
--     for the organization leg in this same call — no new renewal logic)
--   ELSE:
--     preserve existing paid-grant semantics exactly (lifetime NULL rows for
--     manual/promo/subscription are never shortened; finite rows take the
--     computed paid expiry).
--
-- This migration does NOT edit 20251023000001 or any historical migration.
-- It replaces complete_billing_payment with a body that is byte-identical
-- except for the two ON CONFLICT expiry expressions. No backfill, no rewrite
-- of existing rows, no DELETE. Production probe at authoring time showed zero
-- source='free' rows and zero source='subscription' + NULL rows, so no data
-- repair is included; only future transitions are corrected.
--
-- What this migration does NOT do:
--   * No free plan / ₹0 plan / order / payment / Razorpay change.
--   * No RLS change. No retention change. No Creator/Agency tables.
--   * No expiry → Free change. No quota/concurrency change.
--   * No change to All Access, operational tools, buyer_user_id, idempotency.

-- ─────────────────────────────────────────────────────────────
-- 1. Source CHECK already allows 'free' (from 20251023000001) — no DDL needed
-- ─────────────────────────────────────────────────────────────
-- (No ALTER TABLE here. The constraint
--  user_tool_entitlements_source_check already includes 'free'.)

-- ─────────────────────────────────────────────────────────────
-- 2. Payment completion with corrected free → subscription expiry
-- ─────────────────────────────────────────────────────────────
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
    if v_existing_ent.expires_at is null then
      -- Infinite/permanent (e.g., TAG manual promo) — MUST NOT downgrade to finite
      -- Keep existing infinite, preserve access, record payment/order only
      v_new_expires_at := null;
      -- Do not update expires_at or source; keep as is
    else
      -- Finite: apply renewal rule max(existing, now) + period
      if p_billing_period = 'monthly' then
        v_new_expires_at := greatest(v_existing_ent.expires_at, now()) + interval '1 month';
      elsif p_billing_period = 'yearly' then
        v_new_expires_at := greatest(v_existing_ent.expires_at, now()) + interval '1 year';
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
