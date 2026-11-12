# P10 report intake

## Contract

- **Targets:** `tournament` or `organizer`, referenced by public slug.
  Players, teams, organizations, and brands are out of scope.
- **Category:** closed vocabulary — `spam`, `impersonation`,
  `incorrect_details`, `inappropriate_content`, `scam_or_fraud`, `other`.
- **Description:** 10–500 chars. Long enough to be useful, short enough to
  discourage PII dumps. No attachments.
- **Submission timestamp:** server-set, never accepted as input.
- **Status:** `open → under_review → resolved | dismissed`; forward-only, no
  reopening in v1.
- **Resolution:** `action_taken | no_violation | duplicate` plus a reviewer
  reason (5–500 chars). No silent moderation: every closure carries a reason.
- **Reporter:** session-derived. Reporters see only their own filing state;
  they never see the queue, other reports, or reviewer identity.

## Privacy and anti-abuse

- No unnecessary personal data is collected: no email/phone/address fields,
  no file uploads, no geolocation.
- Reporter identity is never rendered to organizers, moderators see it only
  inside the authorized queue, and it appears in no log or error message.
- Coordinated-reporting resistance: per-account rate limiting and duplicate
  collapsing are specified for the approving migration (uniqueness on
  `(reporter, entity, category)` while open) but NOT implemented in P10 —
  intake itself is disabled, so there is nothing to abuse yet.

## Implementation status

- Domain (`src/features/moderation/domain/report.ts`), schemas
  (`src/features/moderation/schemas/report.ts`), and server shell
  (`server/report-writer.ts` intake/review ops, `server/moderation-reader.ts`
  queue shell) exist with the gate closed: `MODERATION_WRITES_ENABLED =
  false`, every op throws `ModerationWriteDisabledError` after validation.
- Presentation shell: the disabled review-queue pages under
  `src/app/workspace/moderation/` (see `moderator-workspace.md`). No public
  report button is added anywhere — intake UI ships with the queue, not
  before it.
- Queue-table DDL, RLS, retention job, and rate-limit counters are
  deferred-decisions (see `deferred-decisions.md`): they require the
  retention/visibility rule (P10-04) first.
