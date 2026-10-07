-- Platform admin foundation — Super Admin authorization + audit (RCCF-ADMIN-02)
-- Implements platform_admins, is_super_admin(), admin_audit_logs without weakening tenant RLS.
-- Tenant RLS (is_org_member, has_tool_access, billing RLS) remains unchanged.

-- ─────────────────────────────────────────────────────────────
-- platform_admins — platform-level role, not organization role
-- ─────────────────────────────────────────────────────────────
create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  reason text
);

alter table public.platform_admins enable row level security;

-- No policies for anon/authenticated → default deny.
-- Service role bypasses RLS; is_super_admin() is SECURITY DEFINER so it can read.
-- Explicitly drop any stray policies if re-running.
drop policy if exists "platform_admins_no_anon" on public.platform_admins;
drop policy if exists "platform_admins_no_auth" on public.platform_admins;

comment on table public.platform_admins is 'Platform super admins — platform-level role above organization. Only service_role may write. Checked via is_super_admin() using auth.uid().';

-- ─────────────────────────────────────────────────────────────
-- is_super_admin() — SECURITY DEFINER helper, uses auth.uid()
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.platform_admins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;
-- service_role automatically has execute, no need to grant

comment on function public.is_super_admin() is 'Returns true if the current authenticated user (auth.uid()) is a platform super admin. SECURITY DEFINER reads platform_admins bypassing RLS.';

-- ─────────────────────────────────────────────────────────────
-- admin_audit_logs — mandatory audit for state-changing admin operations
-- ─────────────────────────────────────────────────────────────
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action ~ '^[a-z_]+\\.[a-z_]+$'),
  target_type text not null check (char_length(target_type) between 2 and 40),
  target_id uuid,
  organization_id uuid references public.organizations(id) on delete set null,
  reason text,
  before jsonb,
  after jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;

-- Super admins may SELECT audit rows
drop policy if exists "admin_audit_select_super_admin" on public.admin_audit_logs;
create policy "admin_audit_select_super_admin"
  on public.admin_audit_logs for select
  to authenticated
  using (public.is_super_admin());

-- No insert/update/delete for anon/authenticated — service_role only via server code.
drop policy if exists "admin_audit_no_insert_anon" on public.admin_audit_logs;
drop policy if exists "admin_audit_no_insert_auth" on public.admin_audit_logs;

create index if not exists admin_audit_actor_idx on public.admin_audit_logs(actor_user_id);
create index if not exists admin_audit_org_idx on public.admin_audit_logs(organization_id);
create index if not exists admin_audit_created_idx on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_action_idx on public.admin_audit_logs(action);

comment on table public.admin_audit_logs is 'Audit trail for Super Admin state-changing operations. Only is_super_admin may read; only service_role may write. Never store secrets/tokens in before/after.';
comment on column public.admin_audit_logs.action is 'Format resource.action e.g. organization.suspend, entitlement.grant';
comment on column public.admin_audit_logs.before is 'Safe state summary before change — never secrets/tokens/passwords';
comment on column public.admin_audit_logs.after is 'Safe state summary after change — never secrets/tokens/passwords';
