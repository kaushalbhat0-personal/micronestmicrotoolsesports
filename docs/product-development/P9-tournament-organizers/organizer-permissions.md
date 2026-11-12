# P9 organizer permissions

## Roles

| Role                                   | Organizer profile | Members | Tournaments             | Publish                                         | Verification |
| -------------------------------------- | ----------------- | ------- | ----------------------- | ----------------------------------------------- | ------------ |
| `owner`                                | manage            | manage  | manage                  | submit only                                     | never        |
| `admin`                                | manage            | —       | manage                  | submit only                                     | never        |
| `editor`                               | —                 | —       | draft/edit              | submit only                                     | never        |
| platform moderator (`platform_admins`) | —                 | —       | review queue (disabled) | publish/return/republish/archive (all disabled) | disabled     |

Single-owner launch is sufficient: the founding owner row is immutable in v1
(trigger-blocked edits/deletes, no second-owner promotion path). Admin/editor
support exists in the schema so teams can grow without redesign, but no
separate admin workflow is required at launch.

## Session identity

- Every mutation resolves identity via `ensureAppUser()` (verified session →
  active `app_users` row). No function accepts a `user_id` argument.
- `created_by` is session-derived at the writer and immutable thereafter
  (column policy + trigger).
- Suspended callers fail via `SuspendedError`; unauthenticated callers via
  `UnauthenticatedError`. Both messages are generic by design.
- No service-role credentials exist in browser or request paths.

## Ownership and creation metadata

- `organizers.created_by`: set once from the session, trigger-immutable.
- `organizer_members (organizer_id, user_id)` PK: founding owner row cannot
  be updated or deleted in v1; owner promotion is trigger-blocked.
- `tournaments.created_by`: session-derived; `organizer_id`: immutable after
  creation (a listing never moves between organizers — create a new listing).

## Verification separation

`canTouchVerification()` returns false for every role including moderator:
no organizer role and no current moderator flow can confirm an organizer.
Trust transitions require a separately approved verification boundary with
evidence handling and retention rules.

## Moderation separation

Publish/return/republish/archive are reserved for platform moderators
(`is_super_admin()`), and every one of them is **disabled** in P9: the
lifecycle trigger raises on those transitions and
`assertModerationTransitionAllowed()` throws before any database touch. No
moderator action is reachable from any route.

## What stays disabled

Organization ownership assignment, team↔org association writes, organizer
member invitation/transfer, verification approval/rejection, evidence
uploads, sponsorship/recruitment postings, contact handoffs with PII.
