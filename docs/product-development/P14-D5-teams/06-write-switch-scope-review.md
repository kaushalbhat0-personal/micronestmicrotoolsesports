# 06 — Write-Switch Scope Review (P14-D5)

**No switches changed in this phase.** All remain `false`.

| Switch | Definition | Controls |
| --- | --- | --- |
| `WORKSPACE_WRITES_ENABLED` | `src/features/teams/server/workspace-writer.ts` | **Teams only**: `createTeamOp`, `updateTeamSettingsOp` (and thus `createTeamAction` / `updateTeamSettingsAction`). Not organizers/news/moderation/tournaments. |
| `ORGANIZER_WRITES_ENABLED` | `organizer-writer.ts` | Organizer profile/tournament org writes |
| `TOURNAMENT_WRITES_ENABLED` | `tournament-writer.ts` | Tournament mutations |
| `MODERATION_WRITES_ENABLED` | `report-writer.ts` | Moderation report/decision writes |
| `NEWS_WRITES_ENABLED` | `article-writer.ts` | Article writes |

## Recommendation for next phase

`WORKSPACE_WRITES_ENABLED` is already Teams-scoped in practice (lives only in the teams workspace writer). Activating it does **not** enable organizer/tournament/moderation/news writes.

Optional hardening before flip: rename to `TEAMS_WRITES_ENABLED` for clarity, or add an alias constant — not required for safety if tests continue pinning the other four switches `false`.

## This phase

Zero `WRITES_ENABLED = true` assignments in `src/`.
