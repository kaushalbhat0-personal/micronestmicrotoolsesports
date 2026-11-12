# 02 — Write-Switch Scope Audit (P14-D6)

## `WORKSPACE_WRITES_ENABLED` references

| Location | Role |
| --- | --- |
| `src/features/teams/domain/workspace.ts` | **Source of truth** constant |
| `src/features/teams/server/workspace-writer.ts` | Re-export; gates `createTeamOp` / `updateTeamSettingsOp` |
| `src/features/teams/server/team-actions.ts` | Calls writer ops only |
| `src/app/teams/_components/team-form.tsx` | UI hint (reads constant) |
| `src/app/workspace/teams/_components/team-settings-form.tsx` | UI hint |
| Tests under `src/features/teams` / `src/app/**/teams` | Pin enabled/disabled behavior |

## Reachable mutations when ON

1. `createTeamAction` → `createTeamOp` → RPC `create_team`
2. `updateTeamSettingsAction` → `updateTeamSettingsOp` → RPC `update_team_settings`

No membership invite/remove, transfer, organizer, tournament, moderation, or news writers share this flag.

## Independent switches (remain false)

`ORGANIZER_WRITES_ENABLED`, `TOURNAMENT_WRITES_ENABLED`, `MODERATION_WRITES_ENABLED`, `NEWS_WRITES_ENABLED`.

## Verdict

Scope is **Teams-exclusive**. No narrow rename required before activation. Server gate is a compile-time boolean — not client/env controllable.
