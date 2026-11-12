-- MicroNest — Tool availability hardening (RCCF-SPONSOR-FINAL-02)
-- Corrects production catalog state: only sponsor-sentinel and prize-splitter
-- are commercially available. Unreleased tools remain present as rows but
-- inactive. Historical seed migration (20250930000003) is left immutable;
-- this corrective migration establishes the production state.
-- Idempotent: safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- 1. Availability correction (deterministic, both directions)
-- ─────────────────────────────────────────────────────────────
update public.tools
set is_active = false
where slug in (
  'scrim-matchmaker',
  'vod-clipper',
  'roster-sentinel'
);

update public.tools
set is_active = true
where slug in (
  'sponsor-sentinel',
  'prize-splitter'
);

-- ─────────────────────────────────────────────────────────────
-- 2. Harden has_tool_access: entitlement never grants an inactive tool
-- All-access previously granted every active-DB tool slug without checking
-- whether the requested tool itself is active, so a stale all-active DB
-- state leaked unreleased tools. Both branches now require the target
-- tool row to exist and be active.
-- ─────────────────────────────────────────────────────────────
create or replace function public.has_tool_access(org_id uuid, tool_slug text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    -- Target tool must be operationally active
    select 1 from public.tools t
    where t.slug = tool_slug
      and t.is_active = true
  ) and (
    exists (
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
        and t.is_active = true
        and te.is_all_access = false
        and (te.expires_at is null or te.expires_at > now())
    )
  );
$$;

-- Grants preserved (function was replaced, not renamed)
grant execute on function public.has_tool_access(uuid, text) to authenticated;
