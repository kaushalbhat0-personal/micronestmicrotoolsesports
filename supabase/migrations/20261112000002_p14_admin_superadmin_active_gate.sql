-- P14-D3: re-home F-A01 (active-status is_super_admin) after D1 teams archival.
-- Depends on: 20261112000001_d1_admin_foundation (platform_admins, is_super_admin v1),
--             G1 app_users.status.
-- Remote: NOT applied in this phase. Additive only. No G1 table changes.
-- Also hardens admin trigger search_path (historical F-A06 admin subset).

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
  'P14-D3 F-A01: platform_admins membership AND app_users.status=active. Fail-closed for missing/suspended/anon callers. Authenticated execute only.';

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

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
