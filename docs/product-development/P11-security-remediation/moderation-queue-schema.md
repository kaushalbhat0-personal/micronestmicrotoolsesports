# Moderation queue schema (proposal)

DDL: `supabase/migrations/20261113000003_p11_moderation_queue.sql` — LOCAL
PROPOSAL ONLY, unapplied. Inert by design (see below).

## Tables (minimum viable queue)

### `moderation_reports` — tournament/organizer reports

`id` PK · `entity_type` (tournament|organizer) · `entity_slug` (slug-shaped
CHECK, no FK — archived rows must never block the audit) · `category`
(6-value CHECK) · `description` (10–500 CHECK) · `reporter_id` nullable
(`app_users`, `ON DELETE SET NULL` — reporter account deletion degrades to
anonymous report, history survives) · `status` (open|under_review|
resolved|dismissed, default open) · `resolution` nullable (3-value CHECK) ·
`reason` nullable (5–500 CHECK when present) · `reviewer_id` nullable
(`app_users`, `ON DELETE RESTRICT` — audit attribution survives) ·
`submitted_at` default now · `decided_at` nullable.

One-open-review-per-entity: partial unique index on
`(entity_type, entity_slug)` where status is open/under_review — duplicate
and conflicting resolutions are unrepresentable at the database.

### `verification_cases` — organizer verification lifecycle + audit

`id` PK · `organizer_id` (`organizers` FK, `ON DELETE RESTRICT` — a case
blocks organizer deletion, history first) · `status`
(submitted|under_review|confirmed|rejected|expired) ·
`evidence_categories` text[] ≤5 (**category names only — never file
references, URLs, or storage pointers; evidence storage is out of scope**)
· `reason` nullable (5–500) · `reviewer_id` nullable (RESTRICT) ·
`submitted_by` nullable (SET NULL) · `submitted_at` · `decided_at` nullable.

Partial unique index on `(organizer_id)` where status is
submitted/under_review.

### `moderation_decisions` — append-only decision audit

`id` PK · `tournament_id` uuid (**FK-free by design** so archival history
survives) · `decision` (5-value CHECK) · `from_lifecycle`/`to_lifecycle`
(lifecycle CHECKs) · `reason` required (5–500 — no silent moderation) ·
`reviewer_id` nullable (RESTRICT) · `created_at`. `BEFORE UPDATE OR DELETE`
trigger raises unconditionally (same append-only pattern as
`admin_audit_logs`); function hardened (`security invoker`, empty
search path, revoked from all API roles).

## Authorization posture (inert until the authority migration)

- RLS enabled on all three tables; **zero policies**; `REVOKE ALL` from
  `public`, `anon`, `authenticated`. Nobody — not even moderators — can read
  or write the queue. The authority migration adds exactly the
  moderator-only policies then.
- No masked RPCs, no EXECUTE grants: the queue is fully separated from
  public projections.
- No reporter-identity exposure path: no reader, no projection, no log
  carries reporter identity; the disabled queue shell lists nothing.
- No reviewer identity supplied by callers: strict schemas reject
  `reviewerId`/`decidedBy`; reviewer columns are populated session-side
  under future moderator policies.
- No self-approval: enforced at assignment (exclude target-organizer
  members) + `isSelfApproval()` guard shape, effective once policies exist.
- No cascade deletion of historical records: RESTRICT/SET NULL only, and no
  `ON DELETE CASCADE` anywhere in the file (pinned by test).

## Out of scope (explicit)

Evidence storage and upload surfaces; reviewer assignment workflow and SLA
display; SECURITY DEFINER helpers; retention purge job (duration still open —
purging follows the approved retention rule, never ad-hoc deletion).
