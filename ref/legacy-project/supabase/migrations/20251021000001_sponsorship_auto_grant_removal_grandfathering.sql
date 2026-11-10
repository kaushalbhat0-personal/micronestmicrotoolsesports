-- MicroNest — Phase 3: stop Sponsorship auto-grant + grandfather owners
-- (RCCF-MULTI-SCOPE-IMPLEMENT-03)
--
-- Intent: move Sponsorship Tracking from the legacy organization-level
-- auto-grant model toward the intended user-level commercial access model,
-- while preserving existing customers and organization-level scope for
-- sponsorship DATA.
--
-- Model after this migration:
--   * NEW organizations: owner membership only. NO automatic
--     tool_entitlements(org, sponsor-sentinel) row.
--   * EXISTING organization-level sponsor-sentinel rows: PRESERVED
--     (dual-read transition — see below). Nothing is deleted here.
--   * Grandfathered owners: receive user_tool_entitlements rows with the
--     EXACT expiry of their organization's legacy entitlement.
--
-- Grandfathering rule (deterministic):
--   For every per-tool (is_all_access = false) tool_entitlements row whose
--   tool is sponsor-sentinel, grant the DISTINCT set of:
--     a) organizations.owner_id,  UNION
--     b) organization_members.user_id where role = 'owner'
--   Both are authoritative ownership signals in this schema (the trigger
--   itself derives (b) from (a) at creation). Ordinary members
--   (role = 'member'/'admin') are NEVER granted. No ownership is invented:
--   users are only included when joined to an existing profiles row.
--
-- Expiry: te.expires_at is copied EXACTLY (NULL stays NULL = lifetime).
-- Expired rows produce expired user grants (access still denied — no revival).
-- Nothing is extended, shortened, or reset.
--
-- Source: 'manual' (existing enum value; the legacy org rows provisioned by
-- the old trigger also used source = 'manual').
--
-- Idempotent: ON CONFLICT (user_id, tool_id) DO NOTHING (unique constraint
-- from 20251020000001). Safe to rerun. No deterministic-ID hacks, no
-- timestamps in keys, no secrets, no environment dependencies.
--
-- What this migration does NOT do:
--   * No DELETE of legacy org rows (backward compatibility during transition).
--   * No touch of all-access rows (owners of all-access orgs keep access via
--     the legacy org row; only per-tool sponsor-sentinel rows are sources).
--   * No touch of operational tools (draft-ban, tie-breaker, prize-splitter).
--   * No billing/order/plan changes. No RLS changes. No Creator/Agency tables.
--   * No generic scope abstraction.
--
-- Retirement note (future, NOT this migration): legacy per-tool
-- sponsor-sentinel org rows may be removed only after the application is
-- proven to serve all entitled users via user grants. That removal belongs
-- to a later phase with its own review.
--
-- Anomaly verification (run after applying; expect zero rows):
--   Organizations with a sponsor-sentinel org grant but no grantable owner:
--     select te.organization_id
--     from public.tool_entitlements te
--     join public.tools t on t.id = te.tool_id
--     where t.slug = 'sponsor-sentinel' and te.is_all_access = false
--       and not exists (
--         select 1 from public.organizations o
--         join public.profiles p on p.id = o.owner_id
--         where o.id = te.organization_id
--       )
--       and not exists (
--         select 1 from public.organization_members m
--         join public.profiles p on p.id = m.user_id
--         where m.organization_id = te.organization_id and m.role = 'owner'
--       );
--
-- ─────────────────────────────────────────────────────────────
-- 1. Stop future automatic sponsor-sentinel provisioning.
-- Membership behavior, SECURITY DEFINER, and search_path hardening
-- are preserved exactly — ONLY the Sponsorship auto-grant is removed.
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (organization_id, user_id) do nothing;

  -- Phase 3: no automatic Sponsorship entitlement for new organizations.
  -- (Removed: insert into tool_entitlements ... where slug = 'sponsor-sentinel')

  return new;
end;
$$;

-- Ensure trigger exists (idempotent)
drop trigger if exists on_organization_created on public.organizations;
create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- ─────────────────────────────────────────────────────────────
-- 2. Grandfather: per-tool sponsor org entitlements → owner user grants.
-- ─────────────────────────────────────────────────────────────
insert into public.user_tool_entitlements (user_id, tool_id, source, expires_at)
select distinct owners.user_id, t.id, 'manual', te.expires_at
from public.tool_entitlements te
join public.tools t
  on t.id = te.tool_id
 and t.slug = 'sponsor-sentinel'
join (
  -- Authoritative owners: organizations.owner_id UNION owner-role members.
  -- Inner join to profiles: never invent a grant for a missing/deleted user.
  select o.id as organization_id, p.id as user_id
  from public.organizations o
  join public.profiles p on p.id = o.owner_id
  union
  select m.organization_id, p.id
  from public.organization_members m
  join public.profiles p on p.id = m.user_id
  where m.role = 'owner'
) owners on owners.organization_id = te.organization_id
where te.is_all_access = false
on conflict (user_id, tool_id) do nothing;
