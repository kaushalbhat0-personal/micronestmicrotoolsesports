-- MicroNest — Superadmin V1-03 hardening (RCCF-SUPERADMIN-V1-03)
-- Fixes audit findings F-01 (P1), F-02 (P2), F-03 (P2). Additive only.
-- DO NOT APPLY AUTOMATICALLY — user applies manually.
--
-- §1 repair_billing_completion(p_payment_id uuid)
--     Genuine repair for the broken state "captured/authorized payment exists
--     but linked order is not paid". The canonical complete_billing_payment()
--     CANNOT fix this state: its idempotency branch returns early when a
--     payment row already exists for the provider payment id, leaving the
--     order unpaid (this was F-01: the old replay audited "paid" although the
--     RPC was a no-op). This repair function instead locks the EXISTING
--     payment + order rows, re-validates every invariant server-side, flips
--     the order to paid, and provisions/renews the entitlement with logic
--     mirrored verbatim from complete_billing_payment (20251027000001,
--     incl. Free→paid upgrade and sponsor-mirror semantics).
--     Guarantees: never inserts a second payment, never duplicates
--     entitlement, billing period/plan resolve from the order's plan only,
--     idempotent when the order is already paid. service_role only.
--
-- §2 revoke_platform_admin_atomic(p_target uuid)
--     Atomic final-admin-protected revoke (F-02). LOCK TABLE serialises
--     concurrent revokes so two simultaneous "revoke the other admin" calls
--     can never yield zero platform admins. Returns jsonb, never raises for
--     expected states: {ok:true} | {ok:false,error:'not_found'|'final_admin'}.
--     service_role only; actor auth stays in the TS layer (requireSuperAdmin).
--
-- §3 cron_run_ledger lifecycle enforcement (F-03)
--     RLS cannot bind service_role, so lifecycle is enforced with BEFORE
--     triggers for all roles: INSERT must start as running; UPDATE allows
--     only running → succeeded/failed with identity columns immutable and
--     completed_at set; DELETE is rejected; terminal rows are immutable.
--     Existing RLS, uniqueness, and the 500-char error limit are untouched.

-- ─────────────────────────────────────────────────────────────
-- §1 repair_billing_completion
-- ─────────────────────────────────────────────────────────────
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
  if v_payment.razorpay_payment_id is null then
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

    -- Sponsor mirror: align buyer user grant to current org expiry (no extension).
    -- Fenced to sponsor-sentinel; NULL buyer (historical orders) skips.
    -- Guarded on the org row existing: never invent access when the org
    -- entitlement itself is absent. Free rows transition to subscription
    -- with the current org expiry; non-free lifetime rows never shorten.
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

comment on function public.repair_billing_completion(uuid) is 'Superadmin repair for captured/authorized payments whose order is not paid. Locks existing rows, validates linkage server-side, never inserts a second payment. Idempotent when already paid.';

-- ─────────────────────────────────────────────────────────────
-- §2 revoke_platform_admin_atomic
-- ─────────────────────────────────────────────────────────────
create or replace function public.revoke_platform_admin_atomic(
  p_target uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_exists boolean;
begin
  if p_target is null then
    raise exception 'Invalid target' using errcode = 'P0001';
  end if;

  -- Serialise concurrent revokes: the existence check, the count, and the
  -- delete run atomically, so two simultaneous "revoke the other admin"
  -- calls can never both succeed and yield zero platform admins.
  lock table public.platform_admins in share row exclusive mode;

  select exists (
    select 1 from public.platform_admins where user_id = p_target
  ) into v_exists;
  if not v_exists then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  select count(*) into v_count from public.platform_admins;
  if v_count <= 1 then
    return jsonb_build_object('ok', false, 'error', 'final_admin');
  end if;

  delete from public.platform_admins where user_id = p_target;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.revoke_platform_admin_atomic(uuid) from public, anon, authenticated;
grant execute on function public.revoke_platform_admin_atomic(uuid) to service_role;

comment on function public.revoke_platform_admin_atomic(uuid) is 'Atomic platform-admin revoke with final-admin protection. LOCK TABLE serialises concurrent revokes. Actor auth stays in the TS layer.';

-- ─────────────────────────────────────────────────────────────
-- §3 cron_run_ledger lifecycle enforcement
-- ─────────────────────────────────────────────────────────────
-- RLS cannot bind service_role (bypasses RLS), so the intended lifecycle
-- running → succeeded | running → failed is enforced with BEFORE triggers
-- for all roles, mirroring the admin_audit_logs append-only precedent
-- (20251014000002). Existing RLS, (job_id, run_id) uniqueness, and the
-- 500-character error limit are untouched. No secrets/payloads stored.

create or replace function public.enforce_cron_run_ledger_lifecycle()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    -- New runs must start as running with no completion timestamp
    if NEW.status is distinct from 'running' then
      raise exception 'cron_run_ledger: INSERT must start as running (job_id=%)', NEW.job_id;
    end if;
    if NEW.completed_at is not null then
      raise exception 'cron_run_ledger: new runs must not carry completed_at (run_id=%)', NEW.run_id;
    end if;
    return NEW;
  elsif TG_OP = 'UPDATE' then
    -- Terminal rows are immutable
    if OLD.status is distinct from 'running' then
      raise exception 'cron_run_ledger: terminal rows are immutable (run_id=%)', OLD.run_id;
    end if;
    -- The single legal transition out of running
    if NEW.status is distinct from 'succeeded' and NEW.status is distinct from 'failed' then
      raise exception 'cron_run_ledger: only running → succeeded/failed allowed (run_id=%)', OLD.run_id;
    end if;
    -- Identity columns are immutable
    if NEW.id is distinct from OLD.id
       or NEW.job_id is distinct from OLD.job_id
       or NEW.run_id is distinct from OLD.run_id
       or NEW.started_at is distinct from OLD.started_at
       or NEW.created_at is distinct from OLD.created_at then
      raise exception 'cron_run_ledger: identity columns are immutable (run_id=%)', OLD.run_id;
    end if;
    -- A terminal transition must record when it completed
    if NEW.completed_at is null then
      raise exception 'cron_run_ledger: terminal transition must set completed_at (run_id=%)', OLD.run_id;
    end if;
    return NEW;
  elsif TG_OP = 'DELETE' then
    raise exception 'cron_run_ledger is append-only: DELETE not allowed (run_id=%)', OLD.run_id;
    return null;
  end if;
  return null;
end;
$$;

drop trigger if exists cron_run_ledger_insert_guard on public.cron_run_ledger;
create trigger cron_run_ledger_insert_guard
  before insert on public.cron_run_ledger
  for each row execute function public.enforce_cron_run_ledger_lifecycle();

drop trigger if exists cron_run_ledger_lifecycle_update on public.cron_run_ledger;
create trigger cron_run_ledger_lifecycle_update
  before update on public.cron_run_ledger
  for each row execute function public.enforce_cron_run_ledger_lifecycle();

drop trigger if exists cron_run_ledger_no_delete on public.cron_run_ledger;
create trigger cron_run_ledger_no_delete
  before delete on public.cron_run_ledger
  for each row execute function public.enforce_cron_run_ledger_lifecycle();

comment on function public.enforce_cron_run_ledger_lifecycle() is 'Enforces cron_run_ledger lifecycle for all roles including service_role: INSERT starts running; UPDATE allows only running → succeeded/failed; DELETE rejected; terminal rows immutable.';
