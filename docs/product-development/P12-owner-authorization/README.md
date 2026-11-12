# P12 — Owner Authorization Decision Gate

## Status: READY FOR OWNER REVIEW — nothing approved, nothing applied

This phase prepares the final owner decision package for operational
moderation and organizer publishing. It is a **decision and migration-design
phase only**: no product features, no operational moderator actions, no
migration application, all three write switches OFF.

## What P12 produces

- **One consolidated decision matrix** (`consolidated-decision-matrix.md`):
  every open decision from P9 → P12 with exact question, recommendation,
  alternatives, impact, security consequences, required DB changes, blocked
  features, and P13-gating flag. Nothing marked approved.
- **F-03 authorization design** (`f03-bootstrap-authorization.md`): who may
  provision, identity binding, duplicate prevention, audit, recovery,
  revocation — exact proposed function/policy/grant design, not implemented.
- **F-02 integrity decision** (`f02-content-integrity-decision.md`):
  per-field materiality table for all 20 protected fields, strict-default
  recommendation, activation conditions.
- **Governance + retention/SLA proposals** (`moderator-governance.md`,
  `retention-and-sla.md`): eligibility, appointment/revocation, separation,
  self-review ban, audit, retention durations, response expectations.
- **Draft activation migration** (`activation-migration-proposal.md`): the
  precise DDL that *would* activate approved capabilities — contained in the
  doc as a fenced proposal block, **not created as a migration file** (per
  the "do not implement" constraint), reviewed clause-by-clause in
  `clause-by-clause-security-review.md`.
- **Sequence + record + next steps** (`verification-and-activation-sequence.md`,
  `owner-approval-record.md` — blank template, all UNAPPROVED,
  `next-phase-recommendation.md`).

## Document index

| # | File | Purpose |
| - | ---- | ------- |
| 2 | `consolidated-decision-matrix.md` | All decisions, P13-gating flags |
| 3 | `f03-bootstrap-authorization.md` | Provisioning authorization design |
| 4 | `f02-content-integrity-decision.md` | Per-field integrity decision |
| 5 | `moderator-governance.md` | Authority governance specification |
| 6 | `retention-and-sla.md` | Retention + service-level proposals |
| 7 | `activation-migration-proposal.md` | Draft activation DDL (doc-contained, not a file) |
| 8 | `clause-by-clause-security-review.md` | Security review of the proposal + six migrations |
| 9 | `verification-and-activation-sequence.md` | 10-stage ordered sequence |
| 10 | `owner-approval-record.md` | Blank sign-off template |
| 11 | `next-phase-recommendation.md` | P13 scope |

## Hard guarantees (pinned by tests)

- All three write switches OFF.
- No migration file added in P12; no migration applied.
- The proposal DDL contains no unrestricted grant, no self-confirmation
  path, no moderation bypass, no F-02 weakening, no report exposure, no
  cross-organizer write path (asserted by
  `src/features/moderation/tests/p12-activation-proposal.test.ts`).
- `owner-approval-record.md` contains no approval (asserted: zero APPROVED marks).
