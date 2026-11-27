-- P13-A F-02 reviewed-snapshot support (snapshot schema + hash + validator).
--
-- Status: LOCAL PROPOSAL ONLY — NOT applied remotely. Additive only: no G1–P12
-- object is modified. This file only ADDS one immutable hash function, one
-- validator function, three columns, one CHECK, and function-level revokes.
-- It changes NO behavior on its own: enforcement lands in the activation
-- migration (20261113000005_p13_activation), which calls the validator from
-- the replaced lifecycle trigger.
--
-- Problem (P12 residual): the P11 freeze protects a row when OLD is
-- `published`, but a `submitted → published` transition must additionally
-- prove the content being published is the content that was reviewed.
-- TOCTOU (edit after review, concurrent edit, stale-approval replay) would
-- otherwise bypass moderation intent while staying technically `published`.
--
-- Design: submission versioning + content hashing + version-bound decisions.
-- - `tournaments.submission_version` (default 0) is bumped by the lifecycle
--   trigger on every `draft → submitted`. Members cannot forge it: the
--   trigger overwrites any caller-supplied value.
-- - `tournament_content_hash()` covers the 19 reviewed content fields
--   (all 20 F-02 freeze fields EXCEPT `published_at`: it is set at publish
--   time by the moderator and frozen thereafter by the F-02 trigger, so it
--   is integrity-protected by freeze, not by snapshot).
-- - `moderation_decisions.content_hash` + `submission_version` bind each
--   publish/republish decision to the exact snapshot reviewed (mandatory for
--   those two decision types, forbidden for the others, via CHECK).
-- - `tournament_review_approval_valid()` re-checks, at transition time:
--   decision type/version/hash match, reviewer currently super-admin
--   (suspended admins fail), and reviewer not a member of the target
--   organizer (DB-enforced no-self-review). SECURITY DEFINER so the check
--   is deterministic regardless of the caller's RLS visibility; revoked
--   from all API roles so it is reachable only from triggers.
--
-- Normalization (determinism): timestamptz via UTC `to_char` (never raw
-- `::text`, which depends on the TimeZone setting); NULLs via a unit
-- separator sentinel; fields joined with a record separator. jsonb uses
-- `::text` (jsonb output is deterministic for equal values).
--
-- Rollback: drop validator + hash functions; drop the three columns and the
-- CHECK (no data exists yet — the file is unapplied, and remotely neither
-- table exists). Reverse order of creation.

-- 1. Submission version on tournaments --------------------------------------
alter table public.tournaments
  add column if not exists submission_version int not null default 0;

comment on column public.tournaments.submission_version is
  'P13-A review binding: bumped by the lifecycle trigger on every draft->submitted. Members cannot forge it (trigger overwrites). P3 RPCs select explicit columns — projection unchanged.';

-- 2. Content hash (19 reviewed fields; published_at excluded — see header) ---
create or replace function public.tournament_content_hash(
  p_title text,
  p_game_key text,
  p_region_code text,
  p_format text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_entry_fee_minor int,
  p_prize_pool_minor int,
  p_currency text,
  p_description text,
  p_organizer_kind text,
  p_organizer_name text,
  p_organizer_slug text,
  p_organizer_id uuid,
  p_registration_url text,
  p_contact_instructions text,
  p_registration_closes_at timestamptz,
  p_eligibility jsonb
)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    extensions.digest(
      concat_ws(
        E'\x1F',
        coalesce(p_title, E'\x1E'),
        coalesce(p_game_key, E'\x1E'),
        coalesce(p_region_code, E'\x1E'),
        coalesce(p_format, E'\x1E'),
        coalesce(to_char(p_starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), E'\x1E'),
        coalesce(to_char(p_ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), E'\x1E'),
        coalesce(p_timezone, E'\x1E'),
        coalesce(p_entry_fee_minor::text, E'\x1E'),
        coalesce(p_prize_pool_minor::text, E'\x1E'),
        coalesce(p_currency, E'\x1E'),
        coalesce(p_description, E'\x1E'),
        coalesce(p_organizer_kind, E'\x1E'),
        coalesce(p_organizer_name, E'\x1E'),
        coalesce(p_organizer_slug, E'\x1E'),
        coalesce(p_organizer_id::text, E'\x1E'),
        coalesce(p_registration_url, E'\x1E'),
        coalesce(p_contact_instructions, E'\x1E'),
        coalesce(to_char(p_registration_closes_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), E'\x1E'),
        coalesce(p_eligibility::text, E'\x1E')
      ),
      'sha256'
    ),
    'hex'
  );
$$;

comment on function public.tournament_content_hash(text, text, text, text, timestamptz, timestamptz, text, int, int, text, text, text, text, text, uuid, text, text, timestamptz, jsonb) is
  'P13-A reviewed snapshot: sha256 over the 19 reviewed content fields with UTC-normalized instants. published_at excluded (freeze-protected, set at publish).';

revoke all on function public.tournament_content_hash(text, text, text, text, timestamptz, timestamptz, text, int, int, text, text, text, text, text, uuid, text, text, timestamptz, jsonb) from public;
revoke all on function public.tournament_content_hash(text, text, text, text, timestamptz, timestamptz, text, int, int, text, text, text, text, text, uuid, text, text, timestamptz, jsonb) from anon;
revoke all on function public.tournament_content_hash(text, text, text, text, timestamptz, timestamptz, text, int, int, text, text, text, text, text, uuid, text, text, timestamptz, jsonb) from authenticated;

-- 3. Decision binding columns -------------------------------------------------
alter table public.moderation_decisions
  add column if not exists content_hash text null,
  add column if not exists submission_version int null;

alter table public.moderation_decisions
  add constraint moderation_decisions_snapshot_binding_check check (
    (
      decision in ('publish', 'republish')
      and content_hash is not null and char_length(content_hash) = 64
      and submission_version is not null
    )
    or (
      decision not in ('publish', 'republish')
      and content_hash is null and submission_version is null
    )
  );

comment on column public.moderation_decisions.content_hash is
  'P13-A: exact snapshot hash reviewed for publish/republish; NULL otherwise (reason-only audit).';
comment on column public.moderation_decisions.submission_version is
  'P13-A: submission version reviewed; stale-approval replay across resubmissions is unrepresentable.';

-- 4. Approval validator --------------------------------------------------------
create or replace function public.tournament_review_approval_valid(
  p_tournament_id uuid,
  p_decision text,
  p_version int,
  p_hash text,
  p_organizer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.moderation_decisions d
    where d.tournament_id = p_tournament_id
      and d.decision = p_decision
      and d.submission_version = p_version
      and (
        p_decision not in ('publish', 'republish')
        or d.content_hash = p_hash
      )
      and d.reviewer_id is not null
      and exists (
        select 1
        from public.platform_admins pa
        join public.app_users au on au.id = pa.user_id
        where pa.user_id = d.reviewer_id
          and au.status = 'active'
      )
      and not exists (
        select 1
        from public.organizer_members m
        where m.organizer_id = p_organizer_id
          and m.user_id = d.reviewer_id
      )
  );
$$;

comment on function public.tournament_review_approval_valid(uuid, text, int, text, uuid) is
  'P13-A: version-bound, hash-bound (publish/republish), currently-active-reviewer, no-self-review approval check. DEFINER for RLS determinism; reachable only from triggers (revoked from all API roles).';

revoke all on function public.tournament_review_approval_valid(uuid, text, int, text, uuid) from public;
revoke all on function public.tournament_review_approval_valid(uuid, text, int, text, uuid) from anon;
revoke all on function public.tournament_review_approval_valid(uuid, text, int, text, uuid) from authenticated;
