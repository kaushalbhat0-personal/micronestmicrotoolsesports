-- MicroNest — Row Level Security
-- Every tenant-owned table has RLS enabled.
-- Helper functions avoid recursive policy pitfalls and use SECURITY DEFINER carefully.

-- ─────────────────────────────────────────────────────────────
-- Enable RLS on all tables
-- ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.tools enable row level security;
alter table public.subscriptions enable row level security;
alter table public.tool_entitlements enable row level security;
alter table public.webhook_events enable row level security;

-- ─────────────────────────────────────────────────────────────
-- Helpers — SECURITY DEFINER, fixed search_path, minimal privilege
-- ─────────────────────────────────────────────────────────────

-- is_org_member: does auth.uid() belong to org?
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
  );
$$;

-- is_org_admin: owner or admin role
create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and role in ('owner','admin')
  );
$$;

-- is_org_owner: specific check
create or replace function public.is_org_owner(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.organizations
    where id = org_id
      and owner_id = auth.uid()
  );
$$;

-- has_tool_access: entitlement check — all-access OR specific tool
create or replace function public.has_tool_access(org_id uuid, tool_slug text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    -- All-access entitlement
    select 1 from public.tool_entitlements
    where organization_id = org_id
      and is_all_access = true
      and (expires_at is null or expires_at > now())
  ) or exists (
    -- Per-tool entitlement
    select 1
    from public.tool_entitlements te
    join public.tools t on t.id = te.tool_id
    where te.organization_id = org_id
      and t.slug = tool_slug
      and te.is_all_access = false
      and (te.expires_at is null or te.expires_at > now())
  );
$$;

-- Grant execute to authenticated (needed for RLS)
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.has_tool_access(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or exists (
    select 1 from public.organization_members om
    where om.user_id = auth.uid()
      and exists (
        select 1 from public.organization_members om2
        where om2.organization_id = om.organization_id
          and om2.user_id = profiles.id
      )
  ));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- organizations
-- ─────────────────────────────────────────────────────────────
drop policy if exists "org_select_member" on public.organizations;
create policy "org_select_member"
  on public.organizations for select
  to authenticated
  using (public.is_org_member(id) or owner_id = auth.uid());

drop policy if exists "org_insert_authenticated" on public.organizations;
create policy "org_insert_authenticated"
  on public.organizations for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "org_update_admin" on public.organizations;
create policy "org_update_admin"
  on public.organizations for update
  to authenticated
  using (public.is_org_admin(id) or owner_id = auth.uid())
  with check (public.is_org_admin(id) or owner_id = auth.uid());

drop policy if exists "org_delete_owner" on public.organizations;
create policy "org_delete_owner"
  on public.organizations for delete
  to authenticated
  using (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- organization_members
-- ─────────────────────────────────────────────────────────────
drop policy if exists "org_members_select_member" on public.organization_members;
create policy "org_members_select_member"
  on public.organization_members for select
  to authenticated
  using (
    public.is_org_member(organization_id)
    or user_id = auth.uid()
  );

drop policy if exists "org_members_insert_admin" on public.organization_members;
create policy "org_members_insert_admin"
  on public.organization_members for insert
  to authenticated
  with check (public.is_org_admin(organization_id));

drop policy if exists "org_members_update_admin" on public.organization_members;
create policy "org_members_update_admin"
  on public.organization_members for update
  to authenticated
  using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

drop policy if exists "org_members_delete_admin" on public.organization_members;
create policy "org_members_delete_admin"
  on public.organization_members for delete
  to authenticated
  using (public.is_org_admin(organization_id));

-- Also allow users to leave (delete own membership) — separate policy
drop policy if exists "org_members_leave_self" on public.organization_members;
create policy "org_members_leave_self"
  on public.organization_members for delete
  to authenticated
  using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- tools — public read for authenticated, no client writes
-- ─────────────────────────────────────────────────────────────
drop policy if exists "tools_select_authenticated" on public.tools;
create policy "tools_select_authenticated"
  on public.tools for select
  to authenticated
  using (is_active = true);

-- Allow anon to read active tools for marketing pages
drop policy if exists "tools_select_anon" on public.tools;
create policy "tools_select_anon"
  on public.tools for select
  to anon
  using (is_active = true);

-- No insert/update/delete policies for client roles -> only service_role bypasses RLS

-- ─────────────────────────────────────────────────────────────
-- subscriptions — member can read own org
-- ─────────────────────────────────────────────────────────────
drop policy if exists "subscriptions_select_member" on public.subscriptions;
create policy "subscriptions_select_member"
  on public.subscriptions for select
  to authenticated
  using (public.is_org_member(organization_id));

-- Writes only via service_role (webhooks). No client policies.

-- ─────────────────────────────────────────────────────────────
-- tool_entitlements — member can read, no client writes
-- ─────────────────────────────────────────────────────────────
drop policy if exists "entitlements_select_member" on public.tool_entitlements;
create policy "entitlements_select_member"
  on public.tool_entitlements for select
  to authenticated
  using (public.is_org_member(organization_id));

-- No insert/update/delete for client — service_role only.

-- ─────────────────────────────────────────────────────────────
-- webhook_events — no client access at all
-- ─────────────────────────────────────────────────────────────
-- Ensure no policies allow anon/authenticated — table remains locked to service_role.
-- Explicitly no policies for select/insert on authenticated/anon.
-- service_role bypasses RLS by design.
