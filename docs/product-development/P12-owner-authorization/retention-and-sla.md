# Retention and service-level policy (proposal — nothing approved)

Operational-record retention is separated from public visibility: nothing
below is ever publicly readable; durations govern internal storage only.
Evidence uploads do not exist, so no evidence retention is specified.

## Retention recommendations (all PROPOSED)

| Record | Proposed retention | Rationale |
| ------ | ------------------ | --------- |
| Reports (`moderation_reports`, incl. dismissed) | 24 months after resolution, then purge reporter identity; keep anonymized category counts | Abuse-pattern analysis without indefinite PII |
| Verification cases (`verification_cases`, incl. rejected/expired) | Life of the organizer + 24 months | Re-verification and dispute history |
| Moderation decisions (`moderation_decisions`) + rejection reasons | **Indefinite** (never purged) | The permanent accountability trail; reasons are required, never silent |
| Archived tournaments + their history | **Indefinite** (no-delete posture) | Publish-then-vanish abuse stays evidenced |
| Unpublished (non-archived) drafts/submissions | 24 months of inactivity, then owner-notified purge proposal (separate decision) | Bounded storage without surprise deletion |
| Provisioning audit (`admin_audit_logs` organizer rows) | Indefinite (table is append-only by design) | Founding-ownership provenance |

Purge mechanics (future job, not in activation scope): identity-scrubbing
updates only — never row deletion for decisions/archived content; purges run
under the approved rule with their own audit entries.

## Reviewer response expectations (all PROPOSED)

- **Initial triage:** 5 business days from submission to `under_review` or a
  decision.
- **Decision:** 10 business days from triage to publish/return (tournaments)
  or confirm/reject (verification).
- Expectations are operational targets, not database constraints — the schema
  enforces correctness, not speed.

## Escalation and unresolved cases (PROPOSED)

- Past-SLA items surface to a second reviewer (assignment rule, not schema).
- Twice-past-SLA items escalate to the admin group with a written note.
- No auto-approval and no auto-rejection on timeout: an unreviewed submission
  stays unpublished/unconfirmed indefinitely. Silence is never consent.
- Stale reports (`open` > 90 days with no entity change) may be dismissed as
  `no_violation` only with a written reason, never silently.
