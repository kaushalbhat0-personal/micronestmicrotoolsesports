# P2 Test Evidence

## Static tests (no database — the only kind that can run pre-migration)

Full suite (`npm test`, integration excluded per repo workflow):

- **44 files passed, 459 tests passed, 0 failed** (407 pre-existing +
  52 new P2: writer 10, reader 9, route-lib 8, components 16, audit 9).
- Pre-existing G1/P1/D1 boundary suites all green — no regressions.
- `npm run typecheck` — clean (strict; typedRoutes for all 4 workspace routes).
- `npm run lint` — clean.
- `npm run build` — clean; route table confirms `/workspace/teams`,
  `/workspace/teams/[id]`, `/[id]/roster`, `/[id]/settings` (all dynamic).

## Runtime tests (PostgreSQL/RLS — NOT run, explicitly deferred)

No live-database test exists in P2 by phase constraint (no migration
application, no remote SQL/writes, no Docker, no second project). The
required runtime matrix is specified in `05-server-integration-plan.md`
Gate 2–3 (owner/non-owner/suspended/anon reads+writes, forged ids,
trigger immutability, slug conflicts, helper behavior) and must run on
disposable replay after acceptance. Static fakes assert contract behavior
only — they are labelled as such in every test file header.

## Live render evidence (dev server, pre-migration, no session)

| URL | Expected | Observed |
| --- | --- | --- |
| `/workspace/teams` | 200, sign-in prompt (no session) | 200, "Team workspace" + "Sign in to manage your teams." |
| `/workspace/teams/not-a-uuid` | 404, no DB touch | 404 |
| `/workspace/teams/:uuid/roster` | 200, sign-in prompt (auth precedes visibility) | 200 |
| `/workspace/teams/:uuid/settings` | 200, sign-in prompt | 200, sign-in prompt |

Post-migration, re-record with signed-in owner/captain/member/suspended
sessions plus real rows, at 360px and 1280px viewports.

## Layout evidence (structural, no screenshot tooling in env)

Single-column mobile base; `sm:grid-cols-2` settings pairs + roster grid;
`max-w-3xl` + `px-4 sm:px-6`; labelled controls; `role="status"/"alert"`;
announced skeleton. Same responsive system as the inspected P1 routes.
