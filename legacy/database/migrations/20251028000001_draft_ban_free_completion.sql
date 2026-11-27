-- MicroNest — Draft & Ban Free tier: atomic monthly completion quota (RCCF-DRAFT-BAN-FREE-IMPLEMENT-02A)
--
-- Approved product: 1 completed official match per organization per
-- workspace-local calendar month (organizations.timezone). In-progress drafts
-- unlimited. Consumption is permanent: deleting a completed match does NOT
-- restore the monthly slot. Paid / All Access bypass the quota.
--
-- What this migration does:
-- 1. draft_ban_monthly_completions: minimal consumption ledger
--    (organization_id, month_key YYYY-MM, match_id, consumed_at). The ledger
--    row survives deletion of the draft match (match_id has NO foreign key,
--    so deletes neither cascade nor block). Quota is ledger-based, never a
--    live-row COUNT.
-- 2. consume_draft_ban_completion(): atomic finalize + workspace-month quota
--    in one transaction, serialized per org + local month via
--    pg_advisory_xact_lock (transaction-scoped, PgBouncer-safe). Paid and
--    All Access short-circuit before the quota check with no ledger row.
--    Already-completed rows return idempotently with zero quota consumption.
--    completed_at is always now() — caller timestamps are never trusted.
-- 3. Completion-path guard: direct status→completed or completed_at writes
--    that bypass the RPC are rejected (DBK01). The RPC authorizes itself with
--    a transaction-local marker. Legitimate in_progress→abandoned and draft
--    editing are unaffected. Coexists with draft_ban_guard_completed, which
--    continues to freeze already-completed rows.
-- 4. Primary key + RLS on the ledger (no policies: authenticated/anon denied,
--    service_role bypasses RLS).
--
-- What this migration does NOT do:
--   * No ref_code change (minted at INSERT, gaps from abandoned/deleted
--     drafts are intentional).
--   * No template/history/branding/billing change. No Sponsorship SQL change.
--   * No RLS change to existing tables. No Creator/Agency tables.
--
-- Error contract (SQLSTATE → application mapping in draft-ban-policy.ts):
--   DBQ01 quota_exceeded — Free monthly budget exhausted. No row changed.
--   DBN01 no_access     — no membership, foreign/missing match, no tool, or
--                         neither paid nor Free coverage.
--   DBD01 invalid       — match is not completable (abandoned or unexpected).
--   DBK01 lock_path     — direct write attempted to bypass the RPC.

-- ─────────────────────────────────────────────────────────────
-- 1. Monthly completion ledger (permanent consumption accounting)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.draft_ban_monthly_completions (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  month_key text not null check (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  match_id uuid not null,
  consumed_at timestamptz not null default now(),
  constraint draft_ban_monthly_completions_pkey primary key (organization_id, month_key, match_id)
);

-- The primary key prefix (organization_id, month_key) serves the monthly
-- budget lookup; no additional index is required.
-- match_id is deliberately NOT a foreign key: deleting a draft match must
-- neither delete nor block on its consumption record.

alter table public.draft_ban_monthly_completions enable row level security;

-- ─────────────────────────────────────────────────────────────
-- 2. Atomic completion + workspace-month quota reservation
-- ─────────────────────────────────────────────────────────────
create or replace function public.consume_draft_ban_completion(
  p_org_id uuid,
  p_match_id uuid,
  p_user_id uuid
)
returns public.draft_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tool_id uuid;
  v_match public.draft_matches%rowtype;
  v_org_paid boolean := false;
  v_org_free boolean := false;
  v_tz text;
  v_month_key text;
  v_used integer;
begin
  -- STEP 1 — membership. Never trust the caller's assertion.
  if not exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = p_user_id
  ) then
    raise exception 'no_access: user is not a member of organization' using errcode = 'DBN01';
  end if;

  -- Draft & Ban tool id (must exist and be commercially active).
  select id into v_tool_id from public.tools where slug = 'draft-ban' and is_active = true;
  if not found then
    raise exception 'no_access: draft-ban tool not available' using errcode = 'DBN01';
  end if;

  -- STEP 2 — lock the match row. All later decisions in this
  -- transaction observe the same row state.
  select * into v_match
  from public.draft_matches
  where id = p_match_id
  for update;
  if not found or v_match.organization_id <> p_org_id then
    raise exception 'no_access: match not found in this workspace' using errcode = 'DBN01';
  end if;

  -- STEP 3 — idempotency: an already-completed record finalizes exactly once.
  -- Zero quota, zero ledger rows, existing row returned.
  if v_match.status = 'completed' then
    return v_match;
  end if;

  -- Only in-progress matches may complete (mirrors assertTransition:
  -- abandoned rows are terminal).
  if v_match.status <> 'in_progress' then
    raise exception 'invalid: only in-progress matches can be completed' using errcode = 'DBD01';
  end if;

  -- STEP 4 — access level. Paid (per-tool or All Access, paid sources only)
  -- short-circuits with unlimited completions and no ledger row. Free
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
      raise exception 'no_access: no draft-ban coverage for this workspace' using errcode = 'DBN01';
    end if;
  end if;

  if v_org_free then
    -- STEP 5 — free completion: serialize per org + workspace-local month.
    -- The timezone is read from organizations (server-side, never caller
    -- input); the month key is timezone-aware (DST-safe).
    select timezone into v_tz
    from public.organizations
    where id = p_org_id;
    if v_tz is null or not public.is_valid_iana_timezone(v_tz) then
      raise exception 'invalid: workspace timezone is not configured' using errcode = 'DBD01';
    end if;

    v_month_key := to_char(now() at time zone v_tz, 'YYYY-MM');
    perform pg_advisory_xact_lock(
      hashtext('draft_ban_completion:' || p_org_id::text),
      hashtext(v_month_key)
    );

    -- STEP 6 — budget: ledger rows (permanent consumption) in this
    -- workspace-local month. 1/month (matches
    -- FREE_DRAFT_BAN_COMPLETED_MATCHES_PER_MONTH; SQL cannot import the TS
    -- constant — change both together). Deleting a completed match never
    -- removes its ledger row, so the slot stays consumed.
    select count(*) into v_used
    from public.draft_ban_monthly_completions
    where organization_id = p_org_id
      and month_key = v_month_key;

    if v_used >= 1 then
      raise exception 'quota_exceeded: monthly free draft-ban budget exhausted' using errcode = 'DBQ01';
    end if;

    -- STEP 7 — consume the slot. Same transaction as the guarded UPDATE
    -- below: if the transition fails, this insert rolls back.
    insert into public.draft_ban_monthly_completions (organization_id, month_key, match_id)
    values (p_org_id, v_month_key, p_match_id);
  end if;

  -- STEP 8 — authorize this transaction for the completion-path guard, then
  -- finalize with the database clock (caller timestamps are never trusted).
  perform set_config('draft_ban.authorized_completion', 'on', true);

  update public.draft_matches
  set status = 'completed',
      completed_at = now()
  where id = p_match_id
    and organization_id = p_org_id
    and status = 'in_progress';

  if found then
    select * into v_match
    from public.draft_matches
    where id = p_match_id;
    return v_match;
  end if;

  -- Lost a concurrent race inside this transaction window: the winner's
  -- record is the official one (idempotent, no extra quota consumed here).
  select * into v_match
  from public.draft_matches
  where id = p_match_id;
  return v_match;
end;
$$;

-- Only service_role may execute (same precedent as consume_tie_breaker_lock).
-- All completion paths call through the server with the service-role client
-- for this RPC call only; reads stay on the RLS-aware caller client.
revoke all on function public.consume_draft_ban_completion(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_draft_ban_completion(uuid, uuid, uuid) to service_role;

comment on function public.consume_draft_ban_completion(uuid, uuid, uuid) is
'Atomic draft-ban finalize: membership + coverage + workspace-month ledger quota + locked update in one transaction. Paid/All Access bypass quota with no ledger row. Already-completed rows return idempotently.';

-- ─────────────────────────────────────────────────────────────
-- 3. Completion-path guard: status→completed must finalize through the RPC
-- ─────────────────────────────────────────────────────────────
-- Direct writes (browser/REST, any role including service_role outside the
-- RPC transaction) cannot mint completed records and bypass the quota, nor
-- forge completed_at. The RPC sets a transaction-local marker; each
-- PostgREST statement runs in its own transaction, so the marker can never
-- leak across requests. Legitimate in_progress→abandoned transitions and
-- draft edits (no status/completed_at change) are unaffected.
create or replace function public.draft_ban_require_authorized_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.status is distinct from 'completed'
      and NEW.status = 'completed'
      and coalesce(current_setting('draft_ban.authorized_completion', true), '') <> 'on'
  then
    raise exception 'draft-ban completions must finalize through the official completion operation' using errcode = 'DBK01';
  end if;
  if NEW.completed_at is distinct from OLD.completed_at
      and coalesce(current_setting('draft_ban.authorized_completion', true), '') <> 'on'
  then
    raise exception 'draft-ban completion timestamps are server-generated' using errcode = 'DBK01';
  end if;
  return NEW;
end;
$$;

drop trigger if exists draft_matches_completion_path_guard on public.draft_matches;
create trigger draft_matches_completion_path_guard
  before update of status, completed_at on public.draft_matches
  for each row execute function public.draft_ban_require_authorized_completion();
