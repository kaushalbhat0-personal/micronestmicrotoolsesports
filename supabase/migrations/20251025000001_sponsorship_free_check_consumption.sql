-- MicroNest — Database-authoritative free check consumption (RCCF-FIX-06, FINDING-3)
--
-- Problem: free check consumption was check-then-insert from application code,
-- serialized only by an in-process mutex. Across Vercel instances (and between
-- cron selection-time gates and scan insertion), two concurrent starts with
-- one remaining check could both insert scan rows and both call providers.
--
-- Solution: consume_free_check() performs quota verification + scan-row
-- insertion atomically in one transaction, serialized per user + UTC month by
-- pg_advisory_xact_lock (transaction-scoped — safe under PgBouncer transaction
-- pooling and serverless checkouts; never pg_advisory_lock / session locks).
-- Provider calls happen only after a successful reservation returns.
--
-- Error contract (SQLSTATE → application mapping):
--   SFQ01 quota_exceeded  — monthly budget exhausted OR coverage mismatch.
--                           Message is prefixed 'quota_exceeded:budget:' or
--                           'quota_exceeded:covered:'. No row inserted.
--   SFD01 already_running — a pending/running scan exists for the campaign.
--                           No check consumed (matches existing CONFLICT).
--   SFN01 no_access       — no membership, no tool, or no coverage.
--                           No row inserted.
--
-- Paid/All Access short-circuit BEFORE the lock: valid org grants (including
-- All Access) and valid paid-source user grants insert directly with no budget
-- accounting, preserving existing paid scan behavior byte-for-byte.
-- Expired paid user grants resolve to the free path (same decision table as
-- resolveSponsorshipAccessLevel — the single application-level definition).
--
-- What this migration does NOT do:
--   * No table changes except one additive covering index for the budget count.
--   * No RLS changes. No retention changes. No pricing/billing/checkout changes.
--   * No counter table. No backfill. No DELETE. No Creator/Agency tables.
--   * Does not touch complete_billing_payment or any historical migration.

-- ─────────────────────────────────────────────────────────────
-- 1. Covering index for the monthly budget count
-- ─────────────────────────────────────────────────────────────
-- getFreeUsage()/budget count filters scans by organization + started_at
-- range. scans_org_idx covers organization_id only; this composite keeps the
-- per-reservation count indexed as workspaces grow.
create index if not exists scans_org_started_idx
  on public.scans (organization_id, started_at);

-- ─────────────────────────────────────────────────────────────
-- 2. Atomic free check reservation
-- ─────────────────────────────────────────────────────────────
create or replace function public.consume_free_check(
  p_user_id uuid,
  p_organization_id uuid,
  p_campaign_id uuid,
  p_platform text,
  p_scanner_version text
)
returns public.scans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tool_id uuid;
  v_member_orgs uuid[];
  v_org_paid boolean;
  v_user_source text;
  v_user_expires timestamptz;
  v_free_path boolean := false;
  v_month_key text;
  v_month_start timestamptz;
  v_campaign_org uuid;
  v_campaign_status text;
  v_covered_campaign uuid;
  v_covered_channel uuid;
  v_paid_orgs uuid[];
  v_used integer;
  v_dup uuid;
  v_scan public.scans%rowtype;
begin
  -- STEP 1 — membership. Never trust the caller's assertion.
  if not exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = p_user_id
  ) then
    raise exception 'no_access: user is not a member of organization' using errcode = 'SFN01';
  end if;

  -- Sponsorship tool id.
  select id into v_tool_id from public.tools where slug = 'sponsor-sentinel';
  if not found then
    raise exception 'no_access: sponsorship tool not registered' using errcode = 'SFN01';
  end if;

  -- Member orgs of the quota owner (global budget scope).
  select coalesce(array_agg(organization_id), '{}') into v_member_orgs
  from public.organization_members where user_id = p_user_id;

  -- STEP 2 — access level. Paid short-circuits BEFORE the lock: no metering,
  -- no serialization of paid scans on free locks.
  select exists (
    select 1 from public.tool_entitlements te
    where te.organization_id = p_organization_id
      and (te.expires_at is null or te.expires_at > now())
      and (te.is_all_access = true
        or (te.is_all_access = false and te.tool_id = v_tool_id))
  ) into v_org_paid;

  if not v_org_paid then
    select source, expires_at into v_user_source, v_user_expires
    from public.user_tool_entitlements
    where user_id = p_user_id and tool_id = v_tool_id;
    if not found then
      raise exception 'no_access: no sponsorship coverage' using errcode = 'SFN01';
    end if;
    if v_user_source in ('subscription', 'manual', 'promo')
       and (v_user_expires is null or v_user_expires > now()) then
      -- Valid paid user grant: paid path (no lock, no budget).
      null;
    elsif (v_user_source = 'free' and (v_user_expires is null or v_user_expires > now()))
       or (v_user_source in ('subscription', 'manual', 'promo')
           and v_user_expires is not null and v_user_expires <= now()) then
      -- Valid free grant, or expired paid grant (logical expiry → free
      -- fallback, same decision table as resolveSponsorshipAccessLevel).
      v_free_path := true;
    else
      raise exception 'no_access: no sponsorship coverage' using errcode = 'SFN01';
    end if;
  end if;

  if v_free_path then
    -- STEP 3 — free lock: sponsor_free_check + user + UTC YYYY-MM.
    -- Month-qualified so December/January traffic never serializes together.
    v_month_key := to_char(now() at time zone 'UTC', 'YYYY-MM');
    perform pg_advisory_xact_lock(
      hashtext('sponsor_free_check:' || p_user_id::text),
      hashtext(v_month_key)
    );
    -- UTC month start, matching currentMonthStartIso() exactly.
    v_month_start := (date_trunc('month', now() at time zone 'UTC')) at time zone 'UTC';

    -- STEP 4 — coverage. Requested campaign must be active in this org AND
    -- be the deterministic covered campaign (oldest active across member
    -- orgs). Covered channel must be connected in this org. Never trust
    -- caller-provided coverage claims.
    select organization_id, status into v_campaign_org, v_campaign_status
    from public.sponsor_campaigns where id = p_campaign_id;
    if not found or v_campaign_org <> p_organization_id or v_campaign_status <> 'active' then
      raise exception 'quota_exceeded:covered: campaign is not an active campaign of this workspace' using errcode = 'SFQ02';
    end if;

    select id into v_covered_campaign
    from public.sponsor_campaigns
    where organization_id = any (v_member_orgs) and status = 'active'
    order by created_at, id limit 1;
    if v_covered_campaign is null or v_covered_campaign <> p_campaign_id then
      raise exception 'quota_exceeded:covered: campaign is not the covered free campaign' using errcode = 'SFQ02';
    end if;

    select id into v_covered_channel
    from public.connected_channels
    where organization_id = any (v_member_orgs) and connection_status = 'connected'
    order by created_at, id limit 1;
    if v_covered_channel is null then
      raise exception 'quota_exceeded:covered: no connected free channel' using errcode = 'SFQ02';
    end if;
    if not exists (
      select 1 from public.connected_channels
      where id = v_covered_channel
        and organization_id = p_organization_id
        and connection_status = 'connected'
    ) then
      raise exception 'quota_exceeded:covered: covered channel is not connected in this workspace' using errcode = 'SFQ02';
    end if;

    -- STEP 5 — budget: current-month scans across member orgs, excluding
    -- org-paid (incl. All Access) workspaces. 10/month (matches
    -- FREE_MONTHLY_CHECK_LIMIT; SQL cannot import the TS constant —
    -- change both together), failed/partial included (rows exist
    -- regardless of outcome).
    select coalesce(array_agg(organization_id), '{}') into v_paid_orgs
    from public.tool_entitlements
    where organization_id = any (v_member_orgs)
      and (expires_at is null or expires_at > now())
      and (is_all_access = true
        or (is_all_access = false and tool_id = v_tool_id));

    select count(*) into v_used
    from public.scans
    where organization_id = any (v_member_orgs)
      and not (organization_id = any (v_paid_orgs))
      and started_at >= v_month_start;

    if v_used >= 10 then
      raise exception 'quota_exceeded:budget: monthly free check budget exhausted' using errcode = 'SFQ01';
    end if;
  end if;

  -- STEP 6 — stale expiry (both paths; preserves existing semantics:
  -- pending/running older than 10 minutes is marked failed, matching
  -- SCAN_STALE_THRESHOLD_MS in src/server/repositories/scans.ts).
  update public.scans
  set status = 'failed',
      completed_at = now(),
      error_code = 'stale_timeout',
      error_message = 'Scan expired: stale pending/running beyond threshold'
  where campaign_id = p_campaign_id
    and status in ('pending', 'running')
    and started_at < now() - interval '10 minutes';

  -- STEP 7 — duplicate rule (both paths; rejected duplicates consume nothing).
  select id into v_dup
  from public.scans
  where campaign_id = p_campaign_id and status in ('pending', 'running')
  limit 1;
  if found then
    raise exception 'already_running: a check is already running for this campaign' using errcode = 'SFD01';
  end if;

  -- STEP 8 — insert pending scan (same transaction as every check above).
  -- started_at defaults to now(): callers cannot backdate rows into other
  -- months. Platform CHECK constraint validates p_platform.
  insert into public.scans (organization_id, campaign_id, platform, status, scanner_version)
  values (p_organization_id, p_campaign_id, p_platform, 'pending', p_scanner_version)
  returning * into v_scan;

  return v_scan;

exception
  when unique_violation then
    -- Cross-principal same-campaign race (different locks): the loser of the
    -- partial unique index lands here. Same semantics as SFD01 above.
    raise exception 'already_running: a check is already running for this campaign' using errcode = 'SFD01';
end;
$$;

-- Only service_role may execute (same precedent as complete_billing_payment).
-- All callers already use the service-role client on scan paths.
revoke all on function public.consume_free_check(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.consume_free_check(uuid, uuid, uuid, text, text) to service_role;

comment on function public.consume_free_check(uuid, uuid, uuid, text, text) is
'Atomic free check reservation: membership + entitlement + coverage + monthly budget + duplicate rule + pending scan insert in one transaction, serialized per user/month. Paid/All Access short-circuits before the lock. Provider calls happen only after success.';
