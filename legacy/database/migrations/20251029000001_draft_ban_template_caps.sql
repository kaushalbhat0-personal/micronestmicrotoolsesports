-- MicroNest — Draft & Ban Free tier: race-safe custom template caps
--
-- Approved product: Free workspaces keep at most 3 CUSTOM templates per
-- organization; paid workspaces (per-tool or All Access, paid sources only)
-- keep at most 20 CUSTOM templates. Starter templates (is_starter = true)
-- never consume custom slots, are unlimited, and stay usable at/over cap.
-- Deleting a custom template frees its slot (cap is live-row COUNT based).
--
-- What this migration does:
-- 1. draft_templates.is_starter (boolean NOT NULL DEFAULT false) + backfill:
--    existing rows named exactly 'Standard Veto' (the only starter the app
--    ever provisioned) become starters. No ownership change, no deletion.
-- 2. draft_ban_custom_template_cap(): server-side cap resolution (paid 20,
--    otherwise Free 3). Mirrors FREE_DRAFT_BAN_CUSTOM_TEMPLATES_MAX (3) and
--    TEMPLATES_PER_ORG_MAX (20); SQL cannot import the TS constants — change
--    both together.
-- 3. draft_ban_guard_template_cap(): BEFORE INSERT trigger. Authoritative,
--    race-safe enforcement for EVERY insert path (RPC and direct REST):
--    spoofed is_starter flags are forced back to false unless the insert runs
--    inside the authorized starter RPC transaction; custom inserts serialize
--    per organization via pg_advisory_xact_lock (transaction-scoped,
--    PgBouncer-safe), then count custom rows and enforce the cap.
-- 4. create_draft_template(): atomic custom-template creation (membership +
--    coverage + duplicate-name + insert in one transaction; the trigger holds
--    the cap). Only service_role may execute.
-- 5. ensure_starter_draft_template(): idempotent starter provisioning
--    (membership + per-org lock; creates 'Standard Veto' only when the org
--    has zero templates; concurrent calls converge on one row). Only
--    service_role may execute.
--
-- What this migration does NOT do:
--   * No RLS change. No completion-quota change. No history/branding/billing
--   * change. No Sponsorship/Tie-Breaker/Prize SQL change. No data deletion.
--   * No templateId cross-org FK redesign (match creation already enforces
--   * ownership in match-service requireOwned; the FK stays SET NULL).
--
-- Error contract (SQLSTATE → application mapping in draft-ban-policy.ts):
--   DBT01 template_limit_exceeded — custom-template budget exhausted. No row changed.
--   DBT02 duplicate_template     — a template with this name already exists. No row changed.
--   DBN01 no_access              — no membership, foreign org, no tool, or no coverage.
--
-- ─────────────────────────────────────────────────────────────
-- 1. Starter marker (additive) + one-time classification backfill
-- ─────────────────────────────────────────────────────────────
alter table public.draft_templates
  add column if not exists is_starter boolean not null default false;

-- The only starter the application ever provisioned is named exactly
-- 'Standard Veto' (see standardVetoTemplate/STANDARD_VETO_NAME). Name-based
-- classification is unreliable going forward (templates are renamable), so
-- this one-time UPDATE freezes the existing starters behind the new flag.
-- No ownership, count, or content change — classification only.
update public.draft_templates
  set is_starter = true
  where is_starter = false
    and name = 'Standard Veto';

create index if not exists draft_templates_org_custom_idx
  on public.draft_templates(organization_id)
  where (is_starter = false);

-- ─────────────────────────────────────────────────────────────
-- 2. Server-side cap resolution (paid 20, otherwise Free 3)
-- ─────────────────────────────────────────────────────────────
-- TEMPLATE-CAPS: cap-fn begin
create or replace function public.draft_ban_custom_template_cap(p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_tool_id uuid;
  v_paid boolean := false;
begin
  select id into v_tool_id from public.tools where slug = 'draft-ban' and is_active = true;
  if not found then
    return 3;
  end if;
  select exists (
    select 1 from public.tool_entitlements te
    where te.organization_id = p_org_id
      and (te.expires_at is null or te.expires_at > now())
      and te.source in ('subscription', 'manual', 'promo')
      and (te.is_all_access = true
        or (te.is_all_access = false and te.tool_id = v_tool_id))
  ) into v_paid;
  if v_paid then
    return 20;
  end if;
  return 3;
end;
$$;
-- TEMPLATE-CAPS: cap-fn end

-- ─────────────────────────────────────────────────────────────
-- 3. Authoritative BEFORE INSERT guard (every insert path, race-safe)
-- ─────────────────────────────────────────────────────────────
-- TEMPLATE-CAPS: guard-fn begin
create or replace function public.draft_ban_guard_template_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap integer;
  v_used integer;
begin
  -- Spoof defense: only the authorized starter RPC runs with the
  -- transaction-local marker (each PostgREST statement is its own
  -- transaction, so the marker can never leak across requests). Any other
  -- insert claiming starter status is demoted to a custom template and
  -- subjected to the cap below.
  if NEW.is_starter is true
     and coalesce(current_setting('draft_ban.authorized_starter', true), '') <> 'on'
  then
    NEW.is_starter := false;
  end if;

  -- Authorized starters bypass the quota entirely.
  if NEW.is_starter is true then
    return NEW;
  end if;

  -- Serialize custom-template creation per organization. The lock is held to
  -- transaction end, so concurrent count-then-insert races converge: the
  -- winner commits, the loser observes the winner's row and is rejected.
  perform pg_advisory_xact_lock(hashtext('draft_template:' || NEW.organization_id::text));

  v_cap := public.draft_ban_custom_template_cap(NEW.organization_id);

  select count(*) into v_used
  from public.draft_templates
  where organization_id = NEW.organization_id
    and is_starter = false;

  if v_used >= v_cap then
    raise exception 'template_limit_exceeded: custom template budget exhausted for this workspace'
      using errcode = 'DBT01';
  end if;

  return NEW;
end;
$$;
-- TEMPLATE-CAPS: guard-fn end

drop trigger if exists draft_templates_cap_guard on public.draft_templates;
create trigger draft_templates_cap_guard
  before insert on public.draft_templates
  for each row execute function public.draft_ban_guard_template_cap();

-- Starter-flag freeze: is_starter is server-minted at INSERT and can never
-- change afterwards. A forged UPDATE claiming starter status (quota escape)
-- or demoting the real starter (slot confusion) is silently pinned to the
-- stored value. Service updates only ever send name/config.
create or replace function public.draft_ban_freeze_template_starter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.is_starter is distinct from OLD.is_starter then
    NEW.is_starter := OLD.is_starter;
  end if;
  return NEW;
end;
$$;

drop trigger if exists draft_templates_starter_freeze on public.draft_templates;
create trigger draft_templates_starter_freeze
  before update of is_starter on public.draft_templates
  for each row execute function public.draft_ban_freeze_template_starter();

-- ─────────────────────────────────────────────────────────────
-- 4. Atomic custom-template creation (service_role only)
-- ─────────────────────────────────────────────────────────────
-- TEMPLATE-CAPS: create-fn begin
create or replace function public.create_draft_template(
  p_org_id uuid,
  p_name text,
  p_config jsonb,
  p_user_id uuid
)
returns public.draft_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tool_id uuid;
  v_covered boolean := false;
  v_name text;
  v_row public.draft_templates%rowtype;
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

  -- STEP 2 — coverage: paid (per-tool or All Access, paid sources) or Free.
  -- Expired grants never satisfy coverage. User-level grants are never
  -- consulted (Draft & Ban is organization-scoped).
  select exists (
    select 1 from public.tool_entitlements te
    where te.organization_id = p_org_id
      and (te.expires_at is null or te.expires_at > now())
      and (te.source in ('subscription', 'manual', 'promo') or te.source = 'free')
      and (te.is_all_access = true
        or (te.is_all_access = false and te.tool_id = v_tool_id))
  ) into v_covered;
  if not v_covered then
    raise exception 'no_access: no draft-ban coverage for this workspace' using errcode = 'DBN01';
  end if;

  -- STEP 3 — name hygiene (mirrors templateNameSchema: 1..60 chars, trimmed).
  v_name := btrim(coalesce(p_name, ''));
  if char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'invalid: template name must be 1..60 characters' using errcode = 'DBT02';
  end if;

  -- STEP 4 — duplicate protection (case-insensitive; the UNIQUE constraint
  -- is case-sensitive, so this check owns the product semantic).
  if exists (
    select 1 from public.draft_templates
    where organization_id = p_org_id
      and lower(name) = lower(v_name)
  ) then
    raise exception 'duplicate_template: a template with this name already exists' using errcode = 'DBT02';
  end if;

  -- STEP 5 — insert as a custom template. The BEFORE INSERT guard holds the
  -- per-org advisory lock, counts custom rows, and raises DBT01 at cap.
  -- is_starter is forced false here: callers can never mint quota-exempt
  -- rows through this function.
  insert into public.draft_templates (organization_id, name, config, created_by, is_starter)
  values (p_org_id, v_name, p_config, p_user_id, false)
  returning * into v_row;
  return v_row;

exception
  when unique_violation then
    raise exception 'duplicate_template: a template with this name already exists' using errcode = 'DBT02';
end;
$$;
-- TEMPLATE-CAPS: create-fn end

-- ─────────────────────────────────────────────────────────────
-- 5. Idempotent starter provisioning (service_role only)
-- ─────────────────────────────────────────────────────────────
-- TEMPLATE-CAPS: starter-fn begin
create or replace function public.ensure_starter_draft_template(
  p_org_id uuid,
  p_user_id uuid
)
returns public.draft_templates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_row public.draft_templates%rowtype;
  v_config jsonb := jsonb_build_object(
    'sequence', jsonb_build_array(
      jsonb_build_object('team', 'A', 'type', 'ban'),
      jsonb_build_object('team', 'B', 'type', 'ban'),
      jsonb_build_object('team', 'A', 'type', 'ban'),
      jsonb_build_object('team', 'B', 'type', 'ban'),
      jsonb_build_object('team', 'A', 'type', 'pick'),
      jsonb_build_object('team', 'B', 'type', 'pick')
    ),
    'pool', jsonb_build_array(),
    'teamA', null,
    'teamB', null
  );
begin
  if not exists (
    select 1 from public.organization_members
    where organization_id = p_org_id and user_id = p_user_id
  ) then
    raise exception 'no_access: user is not a member of organization' using errcode = 'DBN01';
  end if;

  -- Serialize against concurrent provisioning AND concurrent custom
  -- creation (same lock key the guard uses).
  perform pg_advisory_xact_lock(hashtext('draft_template:' || p_org_id::text));

  select count(*) into v_count
  from public.draft_templates
  where organization_id = p_org_id;

  -- Preserve the product semantic: the starter exists only for workspaces
  -- with zero templates. Workspaces that already have templates keep them
  -- untouched; return the existing starter when one is present.
  if v_count > 0 then
    select * into v_row
    from public.draft_templates
    where organization_id = p_org_id
      and is_starter = true
    order by created_at asc
    limit 1;
    return v_row;
  end if;

  -- Authorize this transaction to mint the single quota-exempt starter row.
  perform set_config('draft_ban.authorized_starter', 'on', true);

  insert into public.draft_templates (organization_id, name, config, created_by, is_starter)
  values (p_org_id, 'Standard Veto', v_config, p_user_id, true)
  on conflict (organization_id, name) do nothing
  returning * into v_row;
  if found then
    return v_row;
  end if;

  -- Lost a concurrent starter race inside this transaction window: the
  -- winner's starter row is the official one (idempotent, no extra row).
  select * into v_row
  from public.draft_templates
  where organization_id = p_org_id
    and is_starter = true
  order by created_at asc
  limit 1;
  return v_row;
end;
$$;
-- TEMPLATE-CAPS: starter-fn end

-- Only service_role may execute (same precedent as
-- consume_draft_ban_completion). All template creation paths call through
-- the server with the service-role client for these RPC calls only; reads
-- stay on the RLS-aware caller client. Direct REST inserts remain possible
-- under RLS but are subjected to the same cap by the trigger guard.
revoke all on function public.draft_ban_custom_template_cap(uuid) from public, anon, authenticated;
grant execute on function public.draft_ban_custom_template_cap(uuid) to service_role;
revoke all on function public.create_draft_template(uuid, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_draft_template(uuid, text, jsonb, uuid) to service_role;
revoke all on function public.ensure_starter_draft_template(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ensure_starter_draft_template(uuid, uuid) to service_role;

comment on function public.create_draft_template(uuid, text, jsonb, uuid) is
'Atomic draft-ban custom-template creation: membership + coverage + duplicate-name + trigger-guarded cap in one transaction. Free 3, paid 20, starters exempt. Spoofed starter flags are impossible (forced false).';
comment on function public.ensure_starter_draft_template(uuid, uuid) is
'Idempotent draft-ban starter provisioning: creates the quota-exempt Standard Veto only for workspaces with zero templates. Concurrent calls converge on one row.';
