-- MicroNest — Cron run ledger (RCCF-SUPERADMIN-V1-02)
-- Smallest possible append-only run history for meaningful cron jobs.
-- No payload dumping, no secrets, no arbitrary logs.
-- Writers are server-side cron routes via service_role; admin readers
-- use requireSuperAdmin + service_role. RLS default-deny for anon/auth
-- except an explicit super-admin select policy.

create table if not exists public.cron_run_ledger (
  id uuid primary key default gen_random_uuid(),
  job_id text not null check (char_length(job_id) between 2 and 120),
  run_id text not null check (char_length(run_id) between 2 and 120),
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_summary text check (error_summary is null or char_length(error_summary) <= 500),
  created_at timestamptz not null default now()
);

create unique index if not exists cron_run_ledger_run_unique
  on public.cron_run_ledger(job_id, run_id);

create index if not exists cron_run_ledger_job_idx
  on public.cron_run_ledger(job_id, started_at desc);

create index if not exists cron_run_ledger_status_idx
  on public.cron_run_ledger(status);

alter table public.cron_run_ledger enable row level security;

-- Super admins may read run history. No anon/authenticated insert/update/delete
-- policies: writes go through service_role (cron routes) only.
drop policy if exists "cron_run_ledger_select_super_admin" on public.cron_run_ledger;
create policy "cron_run_ledger_select_super_admin"
  on public.cron_run_ledger for select
  to authenticated
  using (public.is_super_admin());
