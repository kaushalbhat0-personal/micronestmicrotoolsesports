# P2 Security Report

## Data boundary

- **Session-scoped reads only.** Workspace routes read through
  `listManagedTeams` / `getManagedTeam` / `listTeamRoster` (session client,
  RLS-scoped base reads for the caller's own rows). The static audit
  (`routes.test.ts`) fails on any `.from("…")` table access or
  `public.teams/team_members/…` reference in route/component sources, any
  service-key/client usage, and any ownership/applicant/decision token in
  the render surface.
- **Strict output mapping.** 12-key ordered assertion on team rows;
  owner/creator ids consumed for basis resolution and never forwarded;
  roster views carry role/game-role/self markers with user_ids as
  non-rendered keys only. Extra keys fail closed.
- **Fail-closed access.** Invalid ids → `notFound` pre-database;
  invisible teams → identical `notFound`; unknown games/roles never
  validated into existence. Errors are generic domain errors.
- **Bounded reads.** Managed list capped at 50, roster at 50, counts via
  exact-head queries. Authority never aggregates across teams.

## Write boundary

- **Kill switch ON** (`WORKSPACE_WRITES_ENABLED: boolean = false`,
  audit-pinned). Validated operations throw `WorkspaceDisabledError`
  before any table touch — proven by fake-client zero-call assertions.
  Server actions validate + session-check, then return the disabled
  message; the writer is never invoked. No fake success exists.
- Below-gate statements (type-checked, unreachable) use session-derived
  ownership, explicit editable columns, and strict schemas that reject
  forged ownership/org/identity keys.

## Isolation (unverified live — stated, not claimed)

Cross-user isolation, RLS execution, and the auth matrix (owner /
non-owner / suspended / anon, forged ids, trigger immutability, 23505
slug conflicts) require Gates 1–2 of the integration plan on disposable
replay. P2 ships no execution evidence and weakens nothing: unauthorized
functionality is unavailable, not faked.

## Non-regression

Zero G1/P1 files modified. Full suite green: 44 files, 459 passed
(52 new P2 tests). Typecheck, lint, production build clean. No legacy
imports; no migration/policy/grant changes; no commits.
