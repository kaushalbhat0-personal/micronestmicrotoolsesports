-- MicroNest — Finder public view expansion (Phase B)
--
-- Additive only: exposes three user-authored, non-PII columns (bio,
-- languages, timezone) on the public player directory projection so the
-- Phase B public profile is a complete vertical slice.
--
-- Privacy review: bio (<=280 chars, author-written), languages (broad
-- labels), timezone (region identifiers like Asia/Kolkata) carry no
-- contact data, no exact location, no evidence linkage. The view still
-- omits user_id, evidence_path, external_link, and full Character ID.
--
-- DO NOT APPLY AUTOMATICALLY. Apply via the standard migration workflow.

-- CREATE OR REPLACE cannot reorder columns (42P16), and the new
-- user-authored columns sit mid-projection. No objects depend on this
-- view, so drop + recreate is safe and keeps logical column order.
drop view if exists public.finder_public_players;

create view public.finder_public_players as
select
  p.handle,
  p.display_name,
  p.avatar_url,
  p.region,
  p.languages,
  p.timezone,
  p.bio,
  p.current_level,
  p.target_level,
  p.primary_role,
  p.secondary_roles,
  p.availability,
  p.looking_for,
  p.open_to_tryout,
  g.game,
  g.ign,
  ('****' || right(g.character_id, 4)) as character_id_masked,
  g.verification_status,
  (g.verification_status = 'verified') as bgmi_verified
from public.finder_profiles p
join public.finder_game_profiles g on g.user_id = p.user_id;

comment on view public.finder_public_players is 'Public-safe Finder directory projection (Phase B: +bio/languages/timezone). Character ID is masked (**** + last 4); evidence paths, user IDs, and contact data are never exposed. Verification means account-control evidence only, never skill/rank.';

-- DROP VIEW discards grants: restore the anon/authenticated reads.
grant select on public.finder_public_players to anon, authenticated;
