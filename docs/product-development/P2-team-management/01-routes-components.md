# P2 Route and Component Inventory

## Routes (all `noindex, nofollow`, `force-dynamic`)

| Route | File | Data path |
| --- | --- | --- |
| `/workspace/teams` | `src/app/workspace/teams/page.tsx` | `listManagedTeams` only; sign-in/empty/unavailable states |
| `/workspace/teams/[id]` | `src/app/workspace/teams/[id]/page.tsx` | `getManagedTeam` only; invalid/invisible → `notFound()` |
| `/workspace/teams/[id]/settings` | `src/app/workspace/teams/[id]/settings/page.tsx` | `getManagedTeam`; form for owner/captain, read-only notice for members |
| `/workspace/teams/[id]/roster` | `src/app/workspace/teams/[id]/roster/page.tsx` | `listTeamRoster`; invalid/invisible → `notFound()` |

## Route support

| File | Responsibility |
| --- | --- |
| `src/app/workspace/teams/actions.ts` | `createTeamAction`, `updateTeamSettingsAction` — session check + pure validation, then disabled-boundary state (writer never called) |
| `src/app/workspace/teams/_lib/params.ts` | `parseWorkspaceTeamId` (never throws), `buildWorkspaceHref` |
| `src/app/workspace/teams/_lib/forms.ts` | `parseCreateTeamForm`, `parseUpdateTeamSettingsForm` — pure FormData-record → strict-contract parsing |

## Components (`src/app/workspace/teams/_components/`)

| Component | File | Notes |
| --- | --- | --- |
| `WorkspaceSignInPrompt`, `WorkspaceUnavailable`, `WorkspaceEmpty` | `workspace-states.tsx` | Honest non-data states; empty links to `/teams/new` |
| `WorkspaceTeamCard` | `workspace-team-card.tsx` | Own-basis badge; Overview/Settings/Roster + public-page links |
| `PermissionNote` | `permission-note.tsx` | Per-basis copy + co-captain/org/suspension/transfer boundaries |
| `TeamSettingsForm` | `team-settings-form.tsx` | Editable fields with values; slug/game/id locked; no owner/org inputs; no action, disabled submit |
| `RosterMemberCard`, `RosterList` | `roster-list.tsx` | Captain highlight, game role, you-marker; empty state; management-disabled note |
| `WorkspaceSkeleton` | `workspace-skeleton.tsx` | Streaming fallback |

## Domain / server (`src/features/teams/`)

| File | Responsibility |
| --- | --- |
| `domain/workspace.ts` | `WorkspaceRole`, `ManagedTeam`, `RosterMemberView`, validation/operation/disabled errors |
| `schemas/workspace.ts` | Strict creation schema; strict `{ teamId, patch }` settings schema; uuid id schema |
| `server/workspace.ts` | `listManagedTeams`, `getManagedTeam`, `listTeamRoster` — session-derived, RLS-scoped reads |
| `server/workspace-writer.ts` | `WORKSPACE_WRITES_ENABLED = false`; validated-then-gated `createTeamOp`, `updateTeamSettingsOp` |

Reused unchanged: D1 `teamSchema`/`teamUpdateSchema` (strict-wrapped, never
edited), `memberRoleSchema`, BGMI vocabulary, game catalogue, G1
`ensureAppUser` + `UnauthenticatedError`/`SuspendedError`, P1 `/teams/new`
creation page (linked, not duplicated).

## Tests

| File | Coverage |
| --- | --- |
| `server/workspace.test.ts` | 9: session identity, suspension, basis resolution (incl. co-captain→member), key-set, roster mapping, 404-equivalence, generic errors |
| `server/workspace-writer.test.ts` | 10: kill switch ON, strict creation/settings contracts, protected-key rejection, disabled-before-table-touch, unauthenticated |
| `_lib/route-lib.test.ts` | 8: id parsing, hrefs, form parsing, forged-key rejection |
| `_components/components.test.tsx` | 16: cards, notes, forms, roster, states, no-internals, responsive grids |
| `routes.test.ts` | 9: static audit (surface, kill switch, session identity, no transfer/captain-assign/org) |
