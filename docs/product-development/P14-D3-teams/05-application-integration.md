# 05 — Application Integration (P14-D3)

## Wired surfaces

| Surface | Integration |
| --- | --- |
| `/teams` + `/teams/[slug]` | Existing directory reader → `search_teams` / `get_team_by_slug` (unchanged contracts) |
| `/teams/new` | `TeamForm` client → `createTeamAction` → gated `createTeamOp` → RPC |
| `/workspace/teams/*` | Existing readers; settings form → `updateTeamSettingsAction` → gated writer |
| Roster | Read-only workspace list (no add/remove controls) |

## Kill switch

`WORKSPACE_WRITES_ENABLED = false` in `workspace-writer.ts` (**unchanged**).

Below the gate, writer calls `rpc('create_team')` / `rpc('update_team_settings')` — never direct table writes.

Actions fail closed with `WORKSPACE_DISABLED_MESSAGE` while disabled. No fake success persistence.

## Files touched (app/feature)

- `src/features/teams/server/workspace-writer.ts` — RPC below gate
- `src/features/teams/server/team-actions.ts` — server actions
- `src/features/teams/server/form-parsers.ts` — form → Zod
- `src/features/teams/domain/workspace.ts` — action state + disabled message
- `src/app/teams/_components/team-form.tsx` — wired form
- `src/app/workspace/teams/_components/team-settings-form.tsx` — wired form
- `src/app/workspace/teams/actions.ts` — re-export actions
- `src/app/teams/new/page.tsx` — copy update
