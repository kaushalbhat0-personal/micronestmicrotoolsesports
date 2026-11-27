# P10 moderation domain

## Entities

| Entity | Purpose | Public? |
| ------ | ------- | ------- |
| `report` (proposed) | A user filing against one tournament or organizer: entity ref, category, bounded description, timestamp, status | Never public; reporter identity never exposed |
| `review` (proposed) | The moderator working item for a report: status, assignment, decision history | Moderators only; organizers see outcomes for their own entities |
| `verification_case` (proposed) | The organizer verification lifecycle: state, evidence refs, audit history | Moderators only; organizers see their own state + reason |
| `moderation_decision` (proposed audit rows) | Append-only record of every publish/return/republish/unpublish/archive with reason | Moderators only; affected organizers see the reason |

None of these tables exists. No P10 migration is applied; the shapes above
are the acceptance target for the approving migration, implemented today as
domain types + Zod schemas + disabled server ops in `src/features/moderation/`.

## Invariants (enforced in code today, in SQL later)

1. **Default-deny.** No anon or ordinary-user read of any moderation row;
   public surfaces expose at most aggregate honesty ("reporting arrives
   later", "not confirmed").
2. **Session-derived identity.** Reporter and reviewer ids come from the
   verified session via `ensureAppUser()` (+ `is_super_admin()` for
   reviewers). They are never accepted as input — schemas reject them.
3. **No self-approval.** An organizer member can never decide on their own
   organizer's listing or verification, even if they are also a platform
   admin (`isSelfApproval()` guard shape; review assignment must exclude
   target-organizer members).
4. **No forged reviewer identity.** There is no `reviewer_id` input anywhere.
5. **No unauthorized status updates.** Reporters cannot move reports; only
   moderators move them forward (`canTransitionReport`); terminal states are
   immutable; reopening is not permitted in v1 (file a new report).
6. **No duplicate or conflicting resolution.** One open review per entity; one
   decision per review; the queue tables (when approved) carry the uniqueness
   constraint.
7. **Minimal data.** Category + ≤500-char description + entity slug. No
   attachments, no contact details, no free-form topics.
8. **Privacy.** Reporter identity and private report details appear in no
   projection, no reader, no component, and no log. The review queue is never
   listed to ordinary users — the disabled shell lists nothing by design.

## What is deliberately NOT built

- No public report button (a button that leads nowhere would be dishonest;
  detail pages already state that reporting arrives later).
- No unrestricted public report listing (would leak reporters and invite
  brigading).
- No automated decision-making (all decisions are manual; see
  `organizer-verification.md`).
- No evidence upload (deferred with media; P10-08).
