-- MicroNest — Unreleased tool catalog cleanup (RCCF-CLEANUP-02)
-- Removes catalog rows for tools that were seeded as roadmap concepts but never
-- built or released: scrim-matchmaker, vod-clipper, roster-sentinel.
-- Historical migrations (20250930000003 seed, 20251015000001 hardening) are left
-- immutable; this migration establishes the released-only production state.
-- Dependent entitlement rows (if any exist) are inert — every access path
-- requires tools.is_active = true — and are removed explicitly before the
-- catalog rows. Released tools, plans, orders, payments, memberships,
-- organizations, users, and audit records are never touched.
-- Idempotent: safe to re-run (deletes are slug-keyed, assertions re-check).

-- ─────────────────────────────────────────────────────────────
-- 1. Pre-delete audit (notices only — never fails on history)
-- ─────────────────────────────────────────────────────────────
do $$
declare
  v_inert_entitlements integer;
  v_user_grants integer;
begin
  select count(*) into v_inert_entitlements
  from public.tool_entitlements te
  join public.tools t on t.id = te.tool_id
  where t.slug in ('scrim-matchmaker', 'vod-clipper', 'roster-sentinel');

  raise notice 'cleanup_unreleased_tools: inert tool_entitlements referencing unreleased tools: %',
    v_inert_entitlements;

  select count(*) into v_user_grants
  from public.user_tool_entitlements ute
  join public.tools t on t.id = ute.tool_id
  where t.slug in ('scrim-matchmaker', 'vod-clipper', 'roster-sentinel');

  raise notice 'cleanup_unreleased_tools: user_tool_entitlements referencing unreleased tools: %',
    v_user_grants;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Remove dependent inert entitlement rows (slug-keyed, idempotent)
-- ─────────────────────────────────────────────────────────────
delete from public.tool_entitlements te
using public.tools t
where te.tool_id = t.id
  and t.slug in ('scrim-matchmaker', 'vod-clipper', 'roster-sentinel');

delete from public.user_tool_entitlements ute
using public.tools t
where ute.tool_id = t.id
  and t.slug in ('scrim-matchmaker', 'vod-clipper', 'roster-sentinel');

-- ─────────────────────────────────────────────────────────────
-- 3. Remove the three unreleased catalog rows
-- ─────────────────────────────────────────────────────────────
delete from public.tools
where slug in ('scrim-matchmaker', 'vod-clipper', 'roster-sentinel');

-- ─────────────────────────────────────────────────────────────
-- 4. Safety assertions (fail closed — released catalog must be exact)
-- ─────────────────────────────────────────────────────────────
do $$
declare
  v_released_active integer;
  v_removed_remaining integer;
  v_active_plans integer;
  v_dangling_plans integer;
begin
  select count(*) into v_released_active
  from public.tools
  where slug in ('sponsor-sentinel', 'prize-splitter', 'draft-ban', 'tie-breaker')
    and is_active = true;
  if v_released_active != 4 then
    raise exception 'cleanup_unreleased_tools: expected 4 active released tools, found %',
      v_released_active;
  end if;

  select count(*) into v_removed_remaining
  from public.tools
  where slug in ('scrim-matchmaker', 'vod-clipper', 'roster-sentinel');
  if v_removed_remaining != 0 then
    raise exception 'cleanup_unreleased_tools: unreleased tool rows remain: %',
      v_removed_remaining;
  end if;

  select count(*) into v_active_plans
  from public.plans
  where is_active = true;
  if v_active_plans != 10 then
    raise exception 'cleanup_unreleased_tools: expected 10 active plans, found %',
      v_active_plans;
  end if;

  select count(*) into v_dangling_plans
  from public.plans p
  where p.tool_id is not null
    and not exists (select 1 from public.tools t where t.id = p.tool_id);
  if v_dangling_plans != 0 then
    raise exception 'cleanup_unreleased_tools: plans reference missing tools: %',
      v_dangling_plans;
  end if;

  raise notice 'cleanup_unreleased_tools: ok (4 released active, 0 removed remain, 10 active plans, 0 dangling plans)';
end;
$$;
