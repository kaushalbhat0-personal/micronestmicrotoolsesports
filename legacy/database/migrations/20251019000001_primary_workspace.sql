-- MicroNest — Primary Workspace foundation (RCCF-MULTI-SCOPE-IMPLEMENT-01)
--
-- Per-user Primary Workspace preference: profiles.primary_organization_id.
-- Preference only — never authorization. Membership, entitlements, service
-- ownership checks, and RLS remain the authorization layers and are untouched.
--
-- Properties:
-- - nullable (users without an organization keep NULL)
-- - ON DELETE SET NULL (deleting a primary org clears the preference, moves nothing)
-- - no uniqueness constraint (many users may prefer the same organization)
-- - no organizations.is_primary (primary belongs to the user, not the org)
-- - no Creator / Agency / Account tables
--
-- Idempotent where practical (safe to replay in development).

-- ─────────────────────────────────────────────────────────────
-- 1. Column
-- ─────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists primary_organization_id uuid
    references public.organizations(id) on delete set null;

-- Lookup index for preference resolution (partial: only set values indexed)
create index if not exists profiles_primary_org_idx
  on public.profiles(primary_organization_id)
  where primary_organization_id is not null;

-- ─────────────────────────────────────────────────────────────
-- 2. Deterministic backfill (never overwrites an existing value)
--
-- Preference order per user:
--   a. oldest owned organization (owner_id = profiles.id), then
--   b. oldest member organization,
--   ordered by organizations.created_at, then id for stability.
-- Users with no organization keep NULL.
-- Moves nothing: no ownership, membership, entitlement, or billing changes.
-- ─────────────────────────────────────────────────────────────
update public.profiles p
set primary_organization_id = sub.org_id
from (
  select distinct on (m.user_id) m.user_id, o.id as org_id
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  where o.owner_id = m.user_id
  order by m.user_id, o.created_at asc, o.id asc
) sub
where p.id = sub.user_id
  and p.primary_organization_id is null;

update public.profiles p
set primary_organization_id = sub.org_id
from (
  select distinct on (m.user_id) m.user_id, o.id as org_id
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  order by m.user_id, o.created_at asc, o.id asc
) sub
where p.id = sub.user_id
  and p.primary_organization_id is null;

-- ─────────────────────────────────────────────────────────────
-- 3. RLS — intentionally unchanged
--
-- Existing policy "profiles_update_own" (USING id = auth.uid(),
-- WITH CHECK id = auth.uid()) already confines writes to the caller's
-- own row. Membership-in-target-organization is enforced in the
-- service layer via requireOrganizationMember (consistent with all
-- existing authorization in this codebase), not in RLS, so unrelated
-- profile updates can never break when membership changes.
-- No policy changes in this migration.
-- ─────────────────────────────────────────────────────────────
