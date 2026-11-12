-- P14-D5: least-privilege EXECUTE grants for Teams RPCs and helpers.
-- Root cause: ALTER DEFAULT PRIVILEGES FOR ROLE postgres/supabase_admin IN SCHEMA public
-- grants EXECUTE on new functions to anon + authenticated + service_role, so
-- REVOKE FROM PUBLIC alone does not remove the explicit anon ACE.
-- Scope: Teams (+ is_super_admin used by admin RLS). No G1 player projection changes.

-- ---------------------------------------------------------------------------
-- Public discovery RPCs — anon + authenticated
-- ---------------------------------------------------------------------------
revoke all on function public.search_teams(text, text, text, integer, integer) from public;
revoke all on function public.search_teams(text, text, text, integer, integer) from anon;
revoke all on function public.search_teams(text, text, text, integer, integer) from authenticated;
grant execute on function public.search_teams(text, text, text, integer, integer) to anon;
grant execute on function public.search_teams(text, text, text, integer, integer) to authenticated;

revoke all on function public.get_team_by_slug(text) from public;
revoke all on function public.get_team_by_slug(text) from anon;
revoke all on function public.get_team_by_slug(text) from authenticated;
grant execute on function public.get_team_by_slug(text) to anon;
grant execute on function public.get_team_by_slug(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Mutation RPCs — authenticated only (never anon / PUBLIC)
-- ---------------------------------------------------------------------------
revoke all on function public.create_team(text, text, text, text, text, text, text, boolean, boolean) from public;
revoke all on function public.create_team(text, text, text, text, text, text, text, boolean, boolean) from anon;
revoke all on function public.create_team(text, text, text, text, text, text, text, boolean, boolean) from authenticated;
grant execute on function public.create_team(text, text, text, text, text, text, text, boolean, boolean) to authenticated;

revoke all on function public.update_team_settings(uuid, text, text, text, text, text, boolean, boolean) from public;
revoke all on function public.update_team_settings(uuid, text, text, text, text, text, boolean, boolean) from anon;
revoke all on function public.update_team_settings(uuid, text, text, text, text, text, boolean, boolean) from authenticated;
grant execute on function public.update_team_settings(uuid, text, text, text, text, text, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Authorization helpers — authenticated only (RLS policy callers); never anon
-- ---------------------------------------------------------------------------
revoke all on function public.is_team_owner(uuid) from public;
revoke all on function public.is_team_owner(uuid) from anon;
revoke all on function public.is_team_owner(uuid) from authenticated;
grant execute on function public.is_team_owner(uuid) to authenticated;

revoke all on function public.is_team_active_member(uuid) from public;
revoke all on function public.is_team_active_member(uuid) from anon;
revoke all on function public.is_team_active_member(uuid) from authenticated;
grant execute on function public.is_team_active_member(uuid) to authenticated;

revoke all on function public.is_team_captain(uuid) from public;
revoke all on function public.is_team_captain(uuid) from anon;
revoke all on function public.is_team_captain(uuid) from authenticated;
grant execute on function public.is_team_captain(uuid) to authenticated;

revoke all on function public.is_super_admin() from public;
revoke all on function public.is_super_admin() from anon;
revoke all on function public.is_super_admin() from authenticated;
grant execute on function public.is_super_admin() to authenticated;

-- Trigger helpers — no client roles
revoke all on function public.enforce_teams_immutable_columns() from public;
revoke all on function public.enforce_teams_immutable_columns() from anon;
revoke all on function public.enforce_teams_immutable_columns() from authenticated;

revoke all on function public.prevent_team_audit_mutation() from public;
revoke all on function public.prevent_team_audit_mutation() from anon;
revoke all on function public.prevent_team_audit_mutation() from authenticated;

-- ---------------------------------------------------------------------------
-- Narrow default-privilege correction for role postgres only.
-- supabase_admin defaults cannot be altered by the linked migration login role
-- (42501); documented as platform residual. Future migrations must continue
-- explicit REVOKE FROM anon/PUBLIC on sensitive functions.
-- authenticated + service_role defaults retained (platform convention).
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;

comment on function public.create_team(text, text, text, text, text, text, text, boolean, boolean) is
  'P14 A4/A5: session-derived owner+captain seed+audit. EXECUTE: authenticated only (P14-D5).';
comment on function public.update_team_settings(uuid, text, text, text, text, text, boolean, boolean) is
  'P14 A1: owner/captain allowlisted settings. EXECUTE: authenticated only (P14-D5).';
