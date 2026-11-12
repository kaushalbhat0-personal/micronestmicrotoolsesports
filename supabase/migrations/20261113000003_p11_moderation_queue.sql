-- P11 moderation queue DDL/RLS proposal (minimum viable queue).
--
-- Status: LOCAL PROPOSAL ONLY — NOT applied remotely. Additive only: no G1–P9
-- table, function, policy, grant, or storage object is modified.
--
-- Scope: three queue tables with default-deny RLS and NO policies, NO grants
-- to API roles. The tables are inert by design: nothing can read or write
-- them until a separately approved migration adds moderator-only policies
-- after the moderation-authority decision (P10-04) lands. This preserves the
-- fail-closed posture while freezing the schema target for review.
--
-- Explicitly NOT included:
--   - Evidence storage (out of scope — no evidence columns, no bucket
--     linkage; see deferred-decisions).
--   - Reviewer assignment workflow (no assignment columns beyond the deciding
--     reviewer; assignment tooling arrives with the authority migration).
--   - SECURITY DEFINER helpers (no direct table power for any role until the
--     authority migration; service-role use stays out of request paths).
--
-- Entity references are slugs/ids WITHOUT foreign keys to content tables:
-- archived tournaments and renamed profiles must never block or cascade the
-- audit trail. Reporter/reviewer identity columns reference app_users with
-- non-cascading actions (see below) so moderation history is never destroyed
-- by account deletion.
--
-- Rollback: drop the three tables in reverse dependency order
-- (moderation_decisions, verification_cases, moderation_reports), then drop
-- the audit-guard function. No data migration is involved.

-- 1. Reports ---------------------------------------------------------------
create table public.moderation_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  entity_type text not null check (entity_type in ('tournament', 'organizer')),
  entity_slug text not null check (entity_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(entity_slug) between 2 and 80),
  category text not null check (category in ('spam', 'impersonation', 'incorrect_details', 'inappropriate_content', 'scam_or_fraud', 'other')),
  description text not null check (char_length(description) between 10 and 500),
  reporter_id uuid null references public.app_users (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'dismissed')),
  resolution text null check (resolution is null or resolution in ('action_taken', 'no_violation', 'duplicate')),
  reason text null check (reason is null or char_length(reason) between 5 and 500),
  reviewer_id uuid null references public.app_users (id) on delete restrict,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz null
);

comment on table public.moderation_reports is
  'P11 moderation queue: user reports against tournaments/organizers. Queue-only: no public reads, reporter identity never exposed. Inert until the authority migration adds moderator policies.';

-- One open review per entity: duplicate/conflicting resolution prevention.
create unique index moderation_reports_open_entity_uidx
on public.moderation_reports (entity_type, entity_slug)
where status in ('open', 'under_review');

-- 2. Verification cases -----------------------------------------------------
create table public.verification_cases (
  id uuid primary key default extensions.gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id) on delete restrict,
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'confirmed', 'rejected', 'expired')),
  evidence_categories text[] not null default '{}' check (
    array_length(evidence_categories, 1) is null or array_length(evidence_categories, 1) <= 5
  ),
  reason text null check (reason is null or char_length(reason) between 5 and 500),
  reviewer_id uuid null references public.app_users (id) on delete restrict,
  submitted_by uuid null references public.app_users (id) on delete set null,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz null
);

comment on table public.verification_cases is
  'P11 moderation queue: organizer verification lifecycle with reviewer audit. Evidence itself is out of scope (no evidence columns). Inert until the authority migration.';

create unique index verification_cases_open_organizer_uidx
on public.verification_cases (organizer_id)
where status in ('submitted', 'under_review');

-- 3. Moderation decisions (append-only audit) --------------------------------
create table public.moderation_decisions (
  id uuid primary key default extensions.gen_random_uuid(),
  tournament_id uuid not null,
  decision text not null check (decision in ('publish', 'return_to_draft', 'republish', 'unpublish', 'archive')),
  from_lifecycle text not null check (from_lifecycle in ('draft', 'submitted', 'published', 'unpublished', 'archived')),
  to_lifecycle text not null check (to_lifecycle in ('draft', 'submitted', 'published', 'unpublished', 'archived')),
  reason text not null check (char_length(reason) between 5 and 500),
  reviewer_id uuid null references public.app_users (id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.moderation_decisions is
  'P11 append-only moderation decision audit: every publish/return/republish/unpublish/archive with reason. Rows are never updated or deleted. tournament_id is intentionally FK-free so archival history survives.';

create or replace function public.prevent_moderation_decision_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'moderation_decisions is append-only';
  return null;
end;
$$;

create trigger trg_moderation_decisions_no_update
before update or delete on public.moderation_decisions
for each row execute function public.prevent_moderation_decision_mutation();

revoke all on function public.prevent_moderation_decision_mutation() from public;
revoke all on function public.prevent_moderation_decision_mutation() from anon;
revoke all on function public.prevent_moderation_decision_mutation() from authenticated;

-- 4. Default-deny: RLS on, NO policies, NO API grants -------------------------
-- No anon/authenticated policy exists on any queue table: without a proven
-- moderator boundary, nobody reads or writes the queue — not even moderators.
-- The authority migration adds exactly the moderator-only policies then.
alter table public.moderation_reports enable row level security;
alter table public.verification_cases enable row level security;
alter table public.moderation_decisions enable row level security;

revoke all on table public.moderation_reports from public;
revoke all on table public.moderation_reports from anon;
revoke all on table public.moderation_reports from authenticated;

revoke all on table public.verification_cases from public;
revoke all on table public.verification_cases from anon;
revoke all on table public.verification_cases from authenticated;

revoke all on table public.moderation_decisions from public;
revoke all on table public.moderation_decisions from anon;
revoke all on table public.moderation_decisions from authenticated;
