# P9 — Tournament Organizer Discovery & Publishing

Status: **CONDITIONAL PASS** (proposal + validated UI + local migrations; runtime publishing NOT live).

## What P9 delivers

- Tournament organizer as a first-class, independent domain (not a player, organization, brand or tournament).
- Public organizer discovery: `/organizers` directory + `/organizers/[slug]` profiles, on the same masked-RPC posture as P1/P3/P8.
- Explicit organizer↔tournament relationship (`organizer_id` FK) wired into the existing P3 tournament discovery (cards + detail link to organizer profiles; profiles surface published-tournament counts).
- Organizer workspace (`/workspace/organizer*`): draft creation/editing forms with strict validation, live preview, and disabled persistence with honest boundary notices.
- Controlled publishing lifecycle proposal (Draft → Submitted → Published → Unpublished → Archived) with the moderation-gated transitions enforced in a local migration trigger and disabled in code.
- Two local migration files (organizer registry + tournament link) with RLS, least-privilege grants, immutability and transition enforcement — NOT applied remotely.

## What P9 does NOT deliver

- No live organizer or tournament writes (both kill switches OFF).
- No moderation queue, no verification pipeline, no media uploads.
- No organization→organizer auto-linkage or permission inheritance.
- No payments, brackets, scheduling, scoring or prize distribution.

## Document map

| File                                 | Contents                                           |
| ------------------------------------ | -------------------------------------------------- |
| `product-scope.md`                   | Scope, non-goals, acceptance criteria              |
| `organizer-domain.md`                | Organizer identity, types, trust, relationships    |
| `organizer-permissions.md`           | Roles, session identity, verification separation   |
| `tournament-publishing-lifecycle.md` | Lifecycle states, transitions, moderation boundary |
| `database-and-migration-design.md`   | Migration proposal, P3 contract preservation       |
| `security-and-rls-review.md`         | Static SQL review, grants, simulated tests, limits |
| `routes-and-components.md`           | Routes, components, integration notes              |
| `media-and-verification-policy.md`   | Storage reservation, no-badge policy               |
| `test-evidence.md`                   | Test/typecheck/lint/build/e2e evidence             |
| `owner-decisions.md`                 | Decisions awaiting owners                          |
| `next-phase-recommendation.md`       | Recommended P10                                    |

## Verdict rationale

CONDITIONAL PASS: public discovery shells, workspace validation UX, permission model, lifecycle and migrations are complete and tested; runtime publishing cannot go live until the owner decisions (moderation authority, verification policy, migration application, organization linkage) are approved. Nothing is fabricated and nothing disabled claims success.
