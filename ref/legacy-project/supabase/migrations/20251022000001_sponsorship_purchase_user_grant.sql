-- MicroNest — Phase 4: sponsorship purchase issues the buyer user grant
-- (RCCF-MULTI-SCOPE-IMPLEMENT-04)
--
-- Intent: when the authenticated purchaser buys a Sponsorship Tracking plan,
-- the purchaser receives a user-scoped sponsor-sentinel grant IN ADDITION TO
-- the unchanged organization-level entitlement. Membership remains mandatory;
-- sponsorship data remains organization-scoped; operational tools and
-- All Access remain organization-scoped and NEVER issue user grants.
--
-- Part 1 — buyer attribution (additive, non-destructive):
--   orders.buyer_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL.
--   Nullable: historical orders stay valid with NULL (never backfilled by
--   guessing — unknown buyers remain unknown). New orders record the buyer.
--   No index: issuance reads the single locked order row by id; no query
--   filters by buyer_user_id in application code.
--
-- Part 2 — payment completion mirror (same transaction, same expiry value):
--   complete_billing_payment gains a fenced sponsor block. When the order is
--   a per-tool sponsor-sentinel purchase AND buyer_user_id IS NOT NULL, the
--   buyer's user_tool_entitlements row is upserted with source='subscription'
--   and expires_at EXACTLY equal to the authoritative organization
--   entitlement expiry computed by this same function call (no second expiry
--   calculation; NULL lifetime mirrors NULL).
--   Fence: tool slug must equal 'sponsor-sentinel'. All-access rows
--   (tool_id NULL) and operational tool rows never reach the block.
--   Idempotent: unique(user_id, tool_id) + ON CONFLICT; replay path mirrors
--   current org expiry without extending. Grandfathered 'manual' rows keep
--   their source/created_at; only expires_at is aligned, and a pre-existing
--   lifetime (NULL) grant is never shortened to finite.
--   Locking/idempotency/HMAC behavior of the original function is untouched.
--
-- Alignment model (matches existing billing lifecycle — expiry-driven, no
-- revocation rows exist for org entitlements either): both legs carry the
-- same expires_at and both access checks exclude expired rows, so org and
-- user access lapse simultaneously. No separate reconciliation system.
--
-- What this migration does NOT do:
--   * No backfill of historical buyers. No data rewrite. No DELETE.
--   * No RLS changes. No pricing/plan changes. No Creator/Agency tables.
--   * No generic scope abstraction. No buyer_user_id anywhere else.
--
-- Deployment ordering: apply this migration BEFORE deploying the application
-- code that writes orders.buyer_user_id (checkout inserts the column).

-- ─────────────────────────────────────────────────────────────
-- 1. Buyer attribution column
-- ─────────────────────────────────────────────────────────────
alter table public.orders
  add column if not exists buyer_user_id uuid references public.profiles(id) on delete set null;

-- ─────────────────────────────────────────────────────────────
-- 2. Payment completion with sponsor user-grant mirror
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

    -- Phase 4: align buyer user grant to current org expiry (no extension).
    -- Fenced to sponsor-sentinel; NULL buyer (historical orders) skips.
    -- Guarded on the org row existing: never invent access when the org
    -- entitlement itself is absent.
    if not v_is_all_access and v_tool_id is not null and v_order.buyer_user_id is not null then
      select id into v_sponsor_tool_id from public.tools where slug = 'sponsor-sentinel';
      if found and v_tool_id = v_sponsor_tool_id then
        perform 1 from public.tool_entitlements
        where organization_id = v_org_id and tool_id = v_tool_id and is_all_access = false;
        if found then
          insert into public.user_tool_entitlements (user_id, tool_id, source, expires_at)
          values (v_order.buyer_user_id, v_tool_id, 'subscription', v_existing_expires_at)
          on conflict (user_id, tool_id) do update set expires_at =
            case when public.user_tool_entitlements.expires_at is null then null else excluded.expires_at end;
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
      -- Optionally we could log, but keep infinite
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

  -- Phase 4: mirror sponsor purchase to buyer user grant (same expiry value).
  -- Fenced to sponsor-sentinel only; NULL buyer (historical orders) skips.
  -- Idempotent via unique(user_id, tool_id); never shortens lifetime grants.
  if not v_is_all_access and v_tool_id is not null and v_order.buyer_user_id is not null then
    select id into v_sponsor_tool_id from public.tools where slug = 'sponsor-sentinel';
    if found and v_tool_id = v_sponsor_tool_id then
      insert into public.user_tool_entitlements (user_id, tool_id, source, expires_at)
      values (v_order.buyer_user_id, v_tool_id, 'subscription', v_new_expires_at)
      on conflict (user_id, tool_id) do update set expires_at =
        case when public.user_tool_entitlements.expires_at is null then null else excluded.expires_at end;
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
