-- MicroNest Esports D1.5.1: security remediation (local only, NOT applied).
--
-- Corrective migration over 20261112000001 + 20261112000002. The two original
-- files are UNCHANGED (see docs/product-discovery/D1.5.1-security-remediation/
-- 08-migration-readiness.md). This file runs third in timestamp order.
--
-- Scope (product-neutral hardening only; no owner-approved decisions assumed):
--   F-A01 suspended super-admin rejection (active-status join, fail-closed).
--   F-T03 active-account guards on team_members update/delete + recruitment
--     insert/update/delete.
--   F-T04 deny direct team_members INSERT (drop policy + revoke grant; future
--     membership RPC placeholder, no implicit consent model).
--   F-T01 teams protected-column freeze (column-level UPDATE grants + trigger).
--     Ownership transfer stays unavailable (D1-D10 BLOCKED, no transfer RPC).
--   F-T02 applicant withdraw-only (policy + column grants + trigger). Captain
--     decision path stays blocked (D1-D3/lifecycle BLOCKED, no captain RPC).
--   F-T06 G1-parity LIKE escaping in search_teams (trim/cap/escape/ESCAPE).
--   F-A06 trigger-function hardening (search_path + revokes).
--   F-A02/F-A03/F-A04 comment + grant clarification (no broad admin API).
--
-- Explicitly NOT changed (BLOCKED pending owner approval): organization
-- membership/permissions, owner transfer, captain decisions, recruitment
-- lifecycle/expiry automation, report retention/visibility, availability
-- vocabulary/caps, game_key equality enforcement, PII visibility narrowing.
--
-- Additive only. No G1 table, function, policy, grant, or storage object touched.

-- A. F-A01: suspended/inactive admins fail is_super_admin() -------------------
-- Identity strictly from auth.uid(); missing/suspended rows -> false.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_admins as pa
    join public.app_users as au on au.id = pa.user_id
    where pa.user_id = auth.uid()
      and au.status = 'active'
  );
$$;

comment on function public.is_super_admin() is
  'D1.5.1 super-admin check: platform_admins membership AND app_users.status=active. Fail-closed for missing/suspended/anon callers. Authenticated execute only.';

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

-- B. F-A06: harden admin trigger functions (no logic change) ------------------
create or replace function public.prevent_admin_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'admin_audit_logs is append-only';
  return null;
end;
$$;

revoke all on function public.prevent_admin_audit_mutation() from public;
revoke all on function public.prevent_admin_audit_mutation() from anon;
revoke all on function public.prevent_admin_audit_mutation() from authenticated;

create or replace function public.enforce_cron_run_ledger_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (TG_OP = 'INSERT') then
    if (NEW.status <> 'running' or NEW.completed_at is not null) then
      raise exception 'cron_run_ledger INSERT must be status=running with no completed_at';
    end if;
    return NEW;
  end if;
  if (TG_OP = 'UPDATE') then
    if (OLD.job_id <> NEW.job_id or OLD.run_id <> NEW.run_id) then
      raise exception 'cron_run_ledger ids are immutable';
    end if;
    if (OLD.status <> 'running' or NEW.status not in ('succeeded', 'failed')) then
      raise exception 'cron_run_ledger UPDATE only running->succeeded|failed';
    end if;
    if (NEW.completed_at is null) then
      raise exception 'cron_run_ledger completion requires completed_at';
    end if;
    return NEW;
  end if;
  raise exception 'cron_run_ledger does not support %', TG_OP;
  return null;
end;
$$;

revoke all on function public.enforce_cron_run_ledger_lifecycle() from public;
revoke all on function public.enforce_cron_run_ledger_lifecycle() from anon;
revoke all on function public.enforce_cron_run_ledger_lifecycle() from authenticated;

create or replace function public.prevent_cron_ledger_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'cron_run_ledger rows cannot be deleted';
  return null;
end;
$$;

revoke all on function public.prevent_cron_ledger_delete() from public;
revoke all on function public.prevent_cron_ledger_delete() from anon;
revoke all on function public.prevent_cron_ledger_delete() from authenticated;

-- C. F-A02/F-A03/F-A04: boundary clarification (comments + explicit revokes) --
-- Writes remain service-role-only after app-layer requireSuperAdmin; there is
-- no RLS read/write path and no DEFINER write helper in D1. Secret scanning
-- (password/secret/token/...) is app-layer only (src/server/admin/audit.ts),
-- not a database guarantee. Row triggers block DML for every role including
-- service-role DML, but TRUNCATE never fires row triggers: owner/service-role
-- truncate is governed by the ops runbook, not by these triggers.
comment on table public.admin_audit_logs is
  'D1.5.1 append-only admin audit (DML): UPDATE/DELETE rejected by trigger for all roles incl. service-role DML. TRUNCATE is not trigger-blocked; owner/service-role truncate governed by ops runbook. Service-role-only writes after app requireSuperAdmin; no RLS path in D1.';

comment on table public.cron_run_ledger is
  'D1.5.1 cron run ledger. INSERT must be running with no completed_at; UPDATE only running->terminal. DELETE rejected by trigger (DML). TRUNCATE is not trigger-blocked; owner/service-role truncate governed by ops runbook. Service-role-only writes after app auth; no RLS path in D1.';

revoke truncate on table public.platform_admins from anon, authenticated;
revoke truncate on table public.admin_audit_logs from anon, authenticated;
revoke truncate on table public.cron_run_ledger from anon, authenticated;

-- D. F-T01: freeze team identity/ownership columns ----------------------------
-- Column grants: authenticated may update only the app-editable columns.
-- Trigger: defense-in-depth even if grants are ever widened. Transfer RPC
-- explicitly out of scope (D1-D10 BLOCKED).
create or replace function public.enforce_teams_immutable_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (NEW.id is distinct from OLD.id
      or NEW.owner_user_id is distinct from OLD.owner_user_id
      or NEW.created_by is distinct from OLD.created_by
      or NEW.game_key is distinct from OLD.game_key
      or NEW.slug is distinct from OLD.slug
      or NEW.organization_id is distinct from OLD.organization_id
      or NEW.created_at is distinct from OLD.created_at) then
    raise exception 'teams protected columns are immutable via direct update (ownership transfer requires D1-D10 approval)';
  end if;
  return NEW;
end;
$$;

revoke all on function public.enforce_teams_immutable_columns() from public;
revoke all on function public.enforce_teams_immutable_columns() from anon;
revoke all on function public.enforce_teams_immutable_columns() from authenticated;

create trigger trg_teams_immutable_columns
before update on public.teams
for each row execute function public.enforce_teams_immutable_columns();

revoke update on table public.teams from authenticated;
grant update (name, description, current_level, target_level, recruiting, is_public, region_code, updated_at)
  on table public.teams to authenticated;

-- E. F-T02: applicant withdraw-only boundary ----------------------------------
drop policy if exists "applications applicant withdraw" on public.applications;

create policy "applications applicant withdraw"
on public.applications for update to authenticated
using (
  applicant_user_id = auth.uid()
  and status in ('applied', 'shortlisted')
)
with check (
  applicant_user_id = auth.uid()
  and status = 'withdrawn'
  and decided_by is null
  and decided_at is null
);

revoke update on table public.applications from authenticated;
grant update (status, updated_at) on table public.applications to authenticated;

create or replace function public.enforce_application_withdraw_boundary()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (NEW.post_id is distinct from OLD.post_id
      or NEW.applicant_user_id is distinct from OLD.applicant_user_id) then
    raise exception 'applications cannot be reassigned to another post or applicant';
  end if;
  if (NEW.decided_by is not null or NEW.decided_at is not null) then
    raise exception 'applications decision metadata is not applicant-writable (captain path pending D1-D3)';
  end if;
  if (not (OLD.status in ('applied', 'shortlisted')) or NEW.status <> 'withdrawn') then
    raise exception 'applications applicant transition is applied|shortlisted -> withdrawn only';
  end if;
  if (NEW.note is distinct from OLD.note
      or NEW.created_at is distinct from OLD.created_at) then
    raise exception 'applications withdraw changes status only';
  end if;
  return NEW;
end;
$$;

revoke all on function public.enforce_application_withdraw_boundary() from public;
revoke all on function public.enforce_application_withdraw_boundary() from anon;
revoke all on function public.enforce_application_withdraw_boundary() from authenticated;

create trigger trg_applications_withdraw_boundary
before update on public.applications
for each row execute function public.enforce_application_withdraw_boundary();

-- F. F-T04: deny direct membership insertion (no implicit consent) ------------
-- No team_members INSERT policy remains: direct PostgREST inserts are denied
-- by RLS default-deny. Membership rows arrive only via a future authorized
-- RPC (invite-accept or application-accept) pending owner approval.
drop policy if exists "team_members captain insert" on public.team_members;

revoke insert on table public.team_members from authenticated;

comment on table public.team_members is
  'D1.5.1 team membership: PK(team_id,user_id). Direct PostgREST INSERT denied (no insert policy/grant); rows arrive only via a future authorized RPC pending owner approval. Captain update/delete remain RLS-gated with active checks.';

-- G. F-T03: active-account guards on roster/post write paths ------------------
drop policy if exists "team_members captain update" on public.team_members;

create policy "team_members captain update"
on public.team_members for update to authenticated
using (
  public.is_team_captain(team_id)
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
)
with check (
  public.is_team_captain(team_id)
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
);

drop policy if exists "team_members captain delete" on public.team_members;

create policy "team_members captain delete"
on public.team_members for delete to authenticated
using (
  public.is_team_captain(team_id)
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
);

drop policy if exists "recruitment_posts captain insert" on public.recruitment_posts;

create policy "recruitment_posts captain insert"
on public.recruitment_posts for insert to authenticated
with check (
  public.is_team_captain(team_id)
  and created_by = auth.uid()
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
);

drop policy if exists "recruitment_posts captain update" on public.recruitment_posts;

create policy "recruitment_posts captain update"
on public.recruitment_posts for update to authenticated
using (
  public.is_team_captain(team_id)
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
)
with check (
  public.is_team_captain(team_id)
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
);

drop policy if exists "recruitment_posts captain delete" on public.recruitment_posts;

create policy "recruitment_posts captain delete"
on public.recruitment_posts for delete to authenticated
using (
  public.is_team_captain(team_id)
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
);

-- H. F-T06: G1-parity LIKE escaping in team discovery --------------------------
-- Same contract as G1 search_player_directory: trim, 120-char cap, escape
-- backslash/percent/underscore with deliberate ESCAPE clause. Result columns,
-- is_public predicate, and limit 1..60 preserved; offset additionally clamped
-- 0..1000 (G1 parity DoS guard).
create or replace function public.search_teams(
  p_game text default null,
  p_region text default null,
  p_query text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  name text,
  game_key text,
  region_code text,
  current_level text,
  target_level text,
  recruiting boolean,
  member_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with raw as (
    select
      nullif(pg_catalog.btrim(coalesce(p_game, '')), '') as v_game_raw,
      nullif(pg_catalog.btrim(coalesce(p_region, '')), '') as v_region_raw,
      nullif(pg_catalog.btrim(coalesce(p_query, '')), '') as v_query_raw,
      case
        when coalesce(p_limit, 24) < 1 then 1
        when coalesce(p_limit, 24) > 60 then 60
        else coalesce(p_limit, 24)
      end as v_limit,
      case
        when coalesce(p_offset, 0) < 0 then 0
        when coalesce(p_offset, 0) > 1000 then 1000
        else coalesce(p_offset, 0)
      end as v_offset
  ),
  params as (
    select
      pg_catalog.lower(v_game_raw) as v_game,
      pg_catalog.lower(v_region_raw) as v_region,
      v_limit,
      v_offset,
      case
        when v_query_raw is null then null
        else '%' || pg_catalog.replace(
          pg_catalog.replace(
            pg_catalog.replace(pg_catalog.left(v_query_raw, 120), '\', '\\'),
            '%', '\%'
          ),
          '_', '\_'
        ) || '%'
      end as v_pattern
    from raw
  )
  select t.id, t.slug, t.name, t.game_key, t.region_code,
         t.current_level, t.target_level, t.recruiting,
         (select count(*) from public.team_members m where m.team_id = t.id)
  from public.teams t
  cross join params
  where t.is_public = true
    and (params.v_game is null or t.game_key = params.v_game)
    and (params.v_region is null or t.region_code = params.v_region)
    and (params.v_pattern is null
      or t.name ilike params.v_pattern escape '\'
      or t.slug ilike params.v_pattern escape '\')
  order by t.created_at desc
  limit (select params.v_limit from params)
  offset (select params.v_offset from params);
$$;

comment on function public.search_teams(text, text, text, integer, integer) is
  'D1.5.1 masked team search: public teams only, bounded pagination (limit 1..60, offset 0..1000), ILIKE-escaped query (120 chars, ESCAPE backslash), no owner/org internals. Authenticated member reads stay on base tables under RLS.';

revoke all on function public.search_teams(text, text, text, integer, integer) from public;
grant execute on function public.search_teams(text, text, text, integer, integer) to anon, authenticated;
