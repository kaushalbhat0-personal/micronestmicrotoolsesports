# Moderator governance specification (proposal — nothing appointed)

## Eligibility

Platform moderators are rows in `public.platform_admins` (`user_id` →
`app_users.id`) satisfying `is_super_admin()`: membership AND an **active**
`app_users` row. Suspended, missing, or anonymous callers fail closed. No
other credential (organizer role, claimant token, UI flag) confers review
power; organizer roles never imply moderation and moderation never implies
organizer membership.

## Appointment and revocation

- **Appointment:** out-of-band owner decision executed as a direct,
  audited write to `platform_admins` (`granted_by`, `reason` 5–500 chars
  required by CHECK). No self-appointment path exists (no policy on the
  table for any API role; ordinary users cannot insert).
- **Revocation:** delete the `platform_admins` row and/or suspend the
  `app_users` row — both take effect immediately because every authority
  check reads live state per request. No caching of authority anywhere in
  the design.
- **No invented workflow:** P12 specifies no appointment UI, no nomination
  flow, no term system. Appointment is a deliberate manual act with a
  written reason, or it does not happen.

## Separation of organizer ownership and moderation

Organizer membership and moderation are disjoint sets with disjoint checks
(`organizer_members` vs `platform_admins`). Holding both is *possible* for a
person and is where the prohibitions below bite — the design assumes overlap
will occur and contains it structurally.

## Self-review prohibition (structural, not advisory)

A moderator who is a member of the target organizer may not decide its
listings or verification. Enforcement layers: (1) review assignment excludes
target-organizer members (operational rule); (2) `isSelfApproval()` guard
shape in code; (3) the activation migration's decision/case policies do not
substitute for assignment hygiene — documented so the building phase cannot
claim "RLS handles it." Violation handling: the decision is void, the audit
row records the conflict, and the case is reassigned.

## Conflict-of-interest handling

Financial interest, competitive participation, or personal relationship with
an organizer disqualifies a moderator from that organizer's queue. Disclosure
is to the admin group; disputed cases default to reassignment, never to
proceeding. No second-order approval can waive a direct self-review.

## Decision audit history

Every publish/return/republish/unpublish/archive and every verification
transition appends an audit row with who, from→to, reason, and timestamp
(`moderation_decisions` append-only trigger; `verification_cases` decision
fields). Organizers see outcomes + reasons for their own entities; reviewer
identity is never exposed to organizers. Audit rows are never updated or
deleted.

## Reviewer accountability

Reviewers are identified by session (`auth.uid()` → `reviewer_id`) on every
decision — anonymous moderation is unrepresentable. Abuse of review power
(malicious takedowns, self-review, reason-free closures — the schema makes
the last one unrepresentable) is answered by revocation plus the permanent
audit trail.

## Operational access boundaries

- Moderators act through the authorized review surface only: queue policies
  + decision/case writes + the replaced lifecycle function. No direct table
  grants beyond what the activation migration names.
- No service-role usage in request paths; no evidence access beyond category
  names (no evidence storage exists); no reporter-identity exposure outside
  the authorized queue read.
- Moderators cannot mint organizers except through the same audited
  `provision_organizer` path (D-11), and provisioning while reviewing the
  same organizer is a conflict under this section.
