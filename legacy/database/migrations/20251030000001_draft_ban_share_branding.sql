-- MicroNest — Draft & Ban Free tier: paid-only branding in share output
-- (RCCF-DRAFT-BAN-FREE-IMPLEMENT-05)
--
-- Approved product: organization logo rendering in Draft & Ban official /
-- shareable outputs is a paid benefit. Free workspaces keep full Draft & Ban
-- functionality (draft, complete, history, share, print, duplicate, templates)
-- with the logo omitted; paid and All Access workspaces see the logo.
--
-- Branding model: LIVE (no snapshot). draft_matches stores no logo column;
-- outputs read organizations.logo_url at render/share time, so paid access
-- at that moment controls exposure. No historical logo is frozen.
--
-- What this migration does (one function replacement, same signature):
-- get_completed_draft_share(p_token): exposes organization_logo_url only when
-- the match's workspace holds an unexpired paid Draft & Ban (or All Access)
-- grant at share time, otherwise NULL. Token shape, completed-only rule,
-- allowlisted fields, and anon/authenticated grants are unchanged.
--
-- What this migration does NOT do:
--   * No schema change. No data change. No RLS/storage change.
--   * No completion-quota, history, template-cap, billing, or other-tool change.
--
-- Error behavior: unchanged (returns null row when not shareable).

-- BRANDING: share-fn begin
create or replace function public.get_completed_draft_share(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'ref_code', m.ref_code,
    'match_name', m.match_name,
    'event_name', m.event_name,
    'format_label', m.format_label,
    'team_a', m.team_a,
    'team_b', m.team_b,
    'sequence', m.sequence,
    'pool', m.pool,
    'actions', m.actions,
    'completed_at', m.completed_at,
    'organization_name', o.name,
    'organization_logo_url', case
      when exists (
        select 1 from public.tool_entitlements te
        left join public.tools t on t.id = te.tool_id
        where te.organization_id = m.organization_id
          and (te.expires_at is null or te.expires_at > now())
          and te.source in ('subscription', 'manual', 'promo')
          and (te.is_all_access = true
            or (te.is_all_access = false and t.slug = 'draft-ban'))
      ) then o.logo_url
      else null
    end
  )
  from public.draft_matches m
  join public.organizations o on o.id = m.organization_id
  where m.share_token = p_token
    and m.status = 'completed'
  limit 1;
$$;
-- BRANDING: share-fn end

-- Grants unchanged from the core migration: the only public path stays public.
revoke all on function public.get_completed_draft_share(uuid) from public;
grant execute on function public.get_completed_draft_share(uuid) to anon, authenticated;
