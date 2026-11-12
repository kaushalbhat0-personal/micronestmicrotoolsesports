# 06 — Test Evidence

Run: `npm test` (vitest, `src/**/*.test.ts`, integration excluded by script).
Date: local run during D1.5.1. Result: **33 files / 335 tests PASS, 0 fail**
(308 pre-existing + 27 new: 18 team + 9 admin).
`npm run typecheck`: PASS. `npm run lint`: PASS.

## Execution levels (honest labeling)

| Test file | Level | What it proves |
|---|---|---|
| `src/features/teams/tests/team-security-boundary.test.ts` | STATIC SQL-text + pure-unit | Remediation text present with exact semantics (grants, policies, triggers, escape chain); LIKE algorithm vectors. |
| `src/server/admin/admin-boundary.test.ts` | STATIC SQL-text + app-helper unit | Active-gated `is_super_admin`, least grants, no invented APIs, secret-scan helper behavior. |
| All other suites (G1 + D1 domain) | Unit (unchanged) | No regression from this phase (no prod TS changed). |

## What was NOT executed

No PostgreSQL/RLS execution: no `attempted UPDATE as captain`, no
`suspended-caller` RPC call, no anon-bypass probe against a live schema.
Forbidden by phase constraints (no Docker, no second project, no `db reset`,
no remote). The 27 new tests therefore claim **textual + algorithmic**
correctness only. Sections `08` lists the replay gates that must run in a
disposable database before any apply.

## G1 green (item 10)

All G1 suites pass unmodified (player-profile, directory, consent, handle,
game, deletion, avatar, query/routes). No G1 source or migration touched.
