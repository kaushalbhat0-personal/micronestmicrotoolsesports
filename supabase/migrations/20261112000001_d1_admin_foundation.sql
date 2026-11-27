-- D1 admin/audit foundation (DESIGN — pending acceptance, NOT applied in D1).
-- Scope: platform_admins + is_super_admin() + admin_audit_logs (append-only)
-- + cron_run_ledger lifecycle. No org tables. No G1 modification (additive only).
-- Security: deny-by-default; super-admin reads via is_super_admin(); writes via
-- SECURITY DEFINER record_admin_audit() with action/target checks; service-role
-- bypasses RLS only after requireSuperAdmin in app layer (see 03-admin-audit-design.md).

create table public.platform_admins (
  user_id uuid primary key references public.app_users (id) on delete cascade,
  granted_by uuid null references public.app_users (id) on delete set null,
  granted_at timestamptz not null default now(),
  reason text null check (reason is null or char_length(reason) between 5 and 500)
);

comment on table public.platform_admins is
  'D1 platform admins: user_id IS app_users(id). Default-deny; membership checked via is_super_admin().';

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

comment on function public.is_super_admin() is
  'D1 super-admin check: caller membership in platform_admins. Authenticated execute only.';

create table public.admin_audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid null references public.app_users (id) on delete set null,
  action text not null check (action ~ '^[a-z_]+\\.[a-z_]+$'),
  target_type text not null check (char_length(target_type) between 2 and 40),
  target_id uuid null,
  reason text null check (reason is null or char_length(reason) <= 500),
  before_state jsonb null,
  after_state jsonb null,
  ip text null check (ip is null or ip ~ '^[0-9a-fA-F:.]{1,45}$'),
  created_at timestamptz not null default now()
);

comment on table public.admin_audit_logs is
  'D1 append-only admin audit. No UPDATE/DELETE for any role including service-role (trigger).';

create or replace function public.prevent_admin_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'admin_audit_logs is append-only';
  return null;
end;
$$;

create trigger trg_admin_audit_no_update
before update or delete on public.admin_audit_logs
for each row execute function public.prevent_admin_audit_mutation();

create table public.cron_run_ledger (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id text not null check (char_length(job_id) between 2 and 120),
  run_id text not null check (char_length(run_id) between 2 and 120),
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  error_summary text null check (error_summary is null or char_length(error_summary) <= 500),
  unique (job_id, run_id)
);

comment on table public.cron_run_ledger is
  'D1 cron run ledger. INSERT must be running with no completed_at; UPDATE only running->terminal.';

create or replace function public.enforce_cron_run_ledger_lifecycle()
returns trigger
language plpgsql
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

create trigger trg_cron_ledger_insert
before insert on public.cron_run_ledger
for each row execute function public.enforce_cron_run_ledger_lifecycle();

create trigger trg_cron_ledger_update
before update on public.cron_run_ledger
for each row execute function public.enforce_cron_run_ledger_lifecycle();

create or replace function public.prevent_cron_ledger_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'cron_run_ledger rows cannot be deleted';
  return null;
end;
$$;

create trigger trg_cron_ledger_no_delete
before delete on public.cron_run_ledger
for each row execute function public.prevent_cron_ledger_delete();

alter table public.platform_admins enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.cron_run_ledger enable row level security;

-- Default-deny: no anon/authenticated table policies. Reads/writes go through
-- SECURITY DEFINER helpers (is_super_admin gate) or service-role after app auth.
-- Explicit grants: revoke all from anon/authenticated/public.

revoke all on table public.platform_admins from public;
revoke all on table public.platform_admins from anon;
revoke all on table public.platform_admins from authenticated;
revoke all on table public.admin_audit_logs from public;
revoke all on table public.admin_audit_logs from anon;
revoke all on table public.admin_audit_logs from authenticated;
revoke all on table public.cron_run_ledger from public;
revoke all on table public.cron_run_ledger from anon;
revoke all on table public.cron_run_ledger from authenticated;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;
