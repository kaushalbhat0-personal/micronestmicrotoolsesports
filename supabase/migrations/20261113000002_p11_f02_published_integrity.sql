-- P11 F-02: database-enforced published-tournament content integrity.
--
-- Status: LOCAL PROPOSAL ONLY — NOT applied remotely. Additive only: no G1–P9
-- table, function, policy, grant, or storage object is modified. This file
-- only ADDS one trigger function, one trigger, and function-level revokes.
--
-- Problem (P10 F-02): the P9 lifecycle trigger passes through every
-- same-state update, and the member update policy covers all roles — so a
-- member could edit a live listing's prize, dates, fee, or registration URL
-- without re-review (bait-and-switch after moderation).
--
-- Fix (strictest safe default, owner policy unresolved): while a row is
-- `published`, EVERY content column is frozen. The only permitted change to a
-- published row is the `published → unpublished` lifecycle transition itself
-- (system columns `updated_by`/`updated_at` ride along; history in
-- `published_at` is preserved, never cleared). Any content edit must follow
-- the two-step path: unpublish first, edit as `unpublished`, resubmit for
-- review. Republication (`unpublished → published`) stays moderator-only per
-- the P9 lifecycle trigger, which this trigger complements (disjoint
-- concerns: that trigger governs transitions, this one governs content).
--
-- Material columns (frozen while published) — full list with rationale in
-- docs/product-development/P11-security-remediation/f02-published-content-integrity.md:
-- title, game_key, region_code, format, starts_at, ends_at, timezone,
-- entry_fee_minor, prize_pool_minor, currency, description, organizer_kind,
-- organizer_name, organizer_slug, organizer_id, registration_url,
-- contact_instructions, registration_closes_at, eligibility.
-- There are NO non-material fields in v1: even contact text can smuggle a
-- scam URL, so the strict default freezes it too. Relaxation of individual
-- safe fields requires owner approval plus a migration edit.
--
-- System columns (never content-checked): id, slug, created_by, created_at,
-- updated_by, updated_at, published_at, lifecycle (transitions governed by
-- the P9 lifecycle trigger; this trigger only freezes content).
--
-- Trigger ordering: `trg_tournaments_freeze_published` sorts before
-- `trg_tournaments_lifecycle` alphabetically at the same BEFORE UPDATE level;
-- concerns are disjoint so order cannot affect correctness (a forbidden
-- content edit raises before/after the transition check with the same net
-- effect: the row is rejected).
--
-- Rollback: `drop trigger trg_tournaments_freeze_published on
-- public.tournaments;` followed by `drop function
-- public.freeze_published_tournament_content();` Restores the P9 posture.

create or replace function public.freeze_published_tournament_content()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (TG_OP = 'UPDATE' and OLD.lifecycle = 'published') then
    if (
      NEW.title is distinct from OLD.title
      or NEW.game_key is distinct from OLD.game_key
      or NEW.region_code is distinct from OLD.region_code
      or NEW.format is distinct from OLD.format
      or NEW.starts_at is distinct from OLD.starts_at
      or NEW.ends_at is distinct from OLD.ends_at
      or NEW.timezone is distinct from OLD.timezone
      or NEW.entry_fee_minor is distinct from OLD.entry_fee_minor
      or NEW.prize_pool_minor is distinct from OLD.prize_pool_minor
      or NEW.currency is distinct from OLD.currency
      or NEW.description is distinct from OLD.description
      or NEW.organizer_kind is distinct from OLD.organizer_kind
      or NEW.organizer_name is distinct from OLD.organizer_name
      or NEW.organizer_slug is distinct from OLD.organizer_slug
      or NEW.organizer_id is distinct from OLD.organizer_id
      or NEW.registration_url is distinct from OLD.registration_url
      or NEW.contact_instructions is distinct from OLD.contact_instructions
      or NEW.registration_closes_at is distinct from OLD.registration_closes_at
      or NEW.eligibility is distinct from OLD.eligibility
      or NEW.published_at is distinct from OLD.published_at
    ) then
      raise exception 'published tournament content is frozen: unpublish before editing';
    end if;
  end if;
  return NEW;
end;
$$;

comment on function public.freeze_published_tournament_content() is
  'P11 F-02: content frozen while published (strict default). Only the published->unpublished transition may touch a published row, without content changes.';

create trigger trg_tournaments_freeze_published
before update on public.tournaments
for each row execute function public.freeze_published_tournament_content();

-- Trigger functions must not be directly callable by API roles.
revoke all on function public.freeze_published_tournament_content() from public;
revoke all on function public.freeze_published_tournament_content() from anon;
revoke all on function public.freeze_published_tournament_content() from authenticated;
