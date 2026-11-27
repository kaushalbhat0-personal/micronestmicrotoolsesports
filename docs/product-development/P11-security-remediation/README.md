# P11 — Organizer & Tournament Security Remediation

## Status

**Verdict: CONDITIONAL PASS** (see `security-test-evidence.md` for the full
battery). The three P10 findings are resolved at the **design + static**
level: two corrective migrations and one inert queue-schema proposal are
drafted, reviewed, and test-pinned — all local-only, all unapplied, all
three write switches OFF. Runtime PostgreSQL/RLS execution remains blocked
under the project constraints and is explicitly not claimed.

## What P11 changes

- **F-01 fixed (proposal):** `20261113000001_p11_f01_trust_guard.sql` freezes
  `organizers.trust_state` for every caller except `is_super_admin()`;
  fail-closed when no moderator authority exists; new rows forced to
  `not_submitted`. See `f01-trust-state-remediation.md`.
- **F-02 fixed (proposal):** `20261113000002_p11_f02_published_integrity.sql`
  freezes all 20 content columns while a tournament is `published` (strict
  default, zero non-material fields); only `published → unpublished` may
  touch a published row, without content changes. See
  `f02-published-content-integrity.md`.
- **F-03 answered without implementation:** three alternatives evaluated,
  `admin_provisioned` recommended, **no bootstrap DDL ships** — no claim or
  provisioning path is implemented without owner approval. See
  `f03-founder-bootstrap.md`.
- **Queue foundation (proposal):** `20261113000003_p11_moderation_queue.sql`
  drafts `moderation_reports`, `verification_cases`, and append-only
  `moderation_decisions` with default-deny RLS, zero policies, zero API
  grants — inert by design. See `moderation-queue-schema.md`.
- **No product features.** No routes, no UI, no reader changes, no switch
  flips. Code additions are domain vocabulary (`material-fields.ts`,
  `bootstrap.ts`), a test SQL helper, and four regression suites.

## Document index

| # | File | Purpose |
| - | ---- | ------- |
| 2 | `owner-decision-status.md` | P9/P10 decision carry-over; everything still PROPOSED/AWAITING |
| 3 | `f01-trust-state-remediation.md` | Trust guard design, fail-closed proof sketch, residual risk |
| 4 | `f02-published-content-integrity.md` | Material field table + rationale, trigger design, strict default |
| 5 | `f03-founder-bootstrap.md` | Three alternatives compared, recommendation, what is NOT built |
| 6 | `moderation-queue-schema.md` | Queue DDL design, RLS posture, audit rules, out-of-scope list |
| 7 | `migration-design.md` | Ordering, contracts, grants, rollback, apply prerequisites |
| 8 | `runtime-verification-strategy.md` | PGlite evaluation, Supabase gaps, what stays unverified |
| 9 | `security-test-evidence.md` | Full battery results + regression (filled after runs) |
| 10 | `deferred-decisions.md` | Everything explicitly not decided or built |
| 11 | `next-phase-recommendation.md` | Smallest safe P12 slice |

## Hard guarantees (pinned by tests)

- `ORGANIZER_WRITES_ENABLED = false`, `TOURNAMENT_WRITES_ENABLED = false`,
  `MODERATION_WRITES_ENABLED = false` (all three asserted in-suite).
- P11 migrations add **no policy and no grant** (asserted against migration
  text); the queue is unreadable and unwritable by every API role.
- Frozen P3 14-column contract untouched; G1–P10 migrations untouched.
