-- Fix: auto-provision Sponsor Sentinel entitlement on organization creation
-- Root cause: handle_new_organization only created membership, never tool_entitlements
-- Dashboard showed static Available while requireEntitlement (has_tool_access) correctly denied.
-- This migration makes provisioning authoritative and backfills existing orgs.

-- 1. Extend trigger to auto-grant sponsor-sentinel (per-tool) for new organizations
create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (organization_id, user_id) do nothing;

  -- Auto-provision Sponsor Sentinel for MVP (per-tool entitlement, source manual)
  -- Idempotent via on conflict; handles concurrent inserts
  insert into public.tool_entitlements (organization_id, tool_id, is_all_access, source)
  select new.id, t.id, false, 'manual'
  from public.tools t
  where t.slug = 'sponsor-sentinel'
  on conflict do nothing;

  return new;
end;
$$;

-- Ensure trigger exists (idempotent)
drop trigger if exists on_organization_created on public.organizations;
create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- 2. Backfill: grant sponsor-sentinel to existing organizations that lack it
-- Excludes orgs that already have per-tool or all-access entitlement
insert into public.tool_entitlements (organization_id, tool_id, is_all_access, source)
select o.id, t.id, false, 'manual'
from public.organizations o
cross join public.tools t
where t.slug = 'sponsor-sentinel'
  and not exists (
    select 1 from public.tool_entitlements te
    where te.organization_id = o.id
      and te.is_all_access = true
      and (te.expires_at is null or te.expires_at > now())
  )
  and not exists (
    select 1 from public.tool_entitlements te
    where te.organization_id = o.id
      and te.tool_id = t.id
      and te.is_all_access = false
      and (te.expires_at is null or te.expires_at > now())
  )
on conflict do nothing;
