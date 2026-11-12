# P10 — Moderation, Verification & Controlled Tournament Launch

## Status

**Verdict: CONDITIONAL PASS** (same posture as P9 — safe foundations advance, privileged operations stay disabled).

Owner decisions remain **proposed, not approved**. Both write kill switches stay **OFF**. No migration is applied. No remote database operation was performed.

## What P10 adds (all safe without privileged authority)

- **Static migration review** of both P9 migrations in application order (`migration-review.md`), with findings ranked by severity.
- **Runtime verification analysis** (`runtime-verification.md`): no faithful local PostgreSQL runtime is available under the project constraints; verification stays at static + simulated level, and every unverified behavior is listed explicitly.
- **Moderation domain + report intake** (`moderation-domain.md`, `report-intake.md`): report categories, statuses, size limits, resolution rules, and a disabled submission/review shell in `src/features/moderation/`. No public report button is added (a button that leads nowhere would be dishonest).
- **Organizer verification workflow** (`organizer-verification.md`): states, evidence categories, who may submit/review, retention, rejection/re-verification/expiry, reviewer audit — all transitions disabled in code.
- **Tournament moderation workflow** (`tournament-moderation.md`): the approved lifecycle with rejection-as-return-to-draft, plus the two load-bearing gaps this phase surfaced (trust-state self-write at the SQL layer; same-state edits to published rows).
- **Moderator workspace shell** (`moderator-workspace.md` + `src/app/workspace/moderation/`): disabled review-queue shell, no operational actions, no ordinary-user exposure.
- **Launch gates** (`controlled-launch-checklist.md`): Stage A–D with per-capability gates. Nothing is enabled by this phase.

## Document index

| # | File | Purpose |
| - | ---- | ------- |
| 2 | `owner-decisions.md` | 9 decisions: recommendation, consequences, approval status |
| 3 | `migration-review.md` | Clause-by-clause static review of both P9 migrations |
| 4 | `runtime-verification.md` | Why runtime verification is blocked; what stays unverified |
| 5 | `moderation-domain.md` | Minimal moderation domain: entities, invariants, anti-abuse rules |
| 6 | `report-intake.md` | Report intake contract: categories, limits, privacy, disabled shell |
| 7 | `organizer-verification.md` | Verification workflow: states, evidence, roles, retention, audit |
| 8 | `tournament-moderation.md` | Lifecycle enforcement, rejection handling, archival, axis separation |
| 9 | `moderator-workspace.md` | Disabled workspace shell: routes, guarantees, non-goals |
| 10 | `security-and-authorization.md` | RLS matrix, grant matrix, role boundaries, evidence (not claims) |
| 11 | `controlled-launch-checklist.md` | Stage A–D gates; per-capability enablement order |
| 12 | `test-evidence.md` | Unit/E2E/typecheck/lint/build results + regression |
| 13 | `deferred-decisions.md` | Everything explicitly NOT decided or built in P10 |
| 14 | `next-phase-recommendation.md` | Smallest safe P11 slice |

## Hard guarantees (pinned by tests)

- `ORGANIZER_WRITES_ENABLED = false` (`src/features/organizers/server/organizer-writer.ts`).
- `TOURNAMENT_WRITES_ENABLED = false` (`src/features/tournaments/server/tournament-writer.ts`).
- `MODERATION_WRITES_ENABLED = false` (`src/features/moderation/server/report-writer.ts`, new in P10).
- Frozen P3 14-column contract untouched (`TOURNAMENT_DIRECTORY_COLUMNS` unchanged; P3 suites green).
- G1–P9 migrations untouched; no new migration file is added by P10 (the moderation tables are a **documented proposal**, not a migration, until the verification/retention policy is approved).
