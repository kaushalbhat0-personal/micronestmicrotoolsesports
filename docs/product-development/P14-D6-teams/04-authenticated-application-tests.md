# 04 — Authenticated Application Tests (P14-D6)

Harness: disposable Auth users + JWT → `parseCreateTeamForm` / `parseUpdateTeamSettingsForm` → `createTeamOp` / `updateTeamSettingsOp` (same path as server actions after session/form parse). Public discovery via PostgREST RPCs.

Stamp: `20261113003932` (`p14d6.*@example.invalid`). **19/19 PASS.** Secrets never logged.

| ID | Path | Role | Result |
| --- | --- | --- | --- |
| flags.teams_on | import writers | — | Teams true |
| flags.others_off | import writers | — | org/tourney/mod/news false |
| app.create_public | form→createTeamOp | owner | created |
| app.create_private | form→createTeamOp | owner | created |
| app.duplicate_slug | form→createTeamOp | owner | `WorkspaceValidationError` |
| app.create_atomic | catalog | — | 1 team + 1 captain + 1 audit + owner=uid |
| app.owner_update | form→updateTeamSettingsOp | owner | ok |
| app.captain_update | form→updateTeamSettingsOp | captain | ok |
| app.cocap_denied | form→updateTeamSettingsOp | co-captain | `WorkspaceOperationError` |
| app.player_denied | form→updateTeamSettingsOp | player | denied |
| app.outsider_denied | form→updateTeamSettingsOp | outsider | denied |
| app.cross_team_denied | form→updateTeamSettingsOp | outsider→private | denied |
| public.search_finds | `search_teams` | anon | public found, no owner id |
| public.search_hides_private | `search_teams` | anon | private hidden |
| public.detail_projection | `get_team_by_slug` | anon | approved keys + `member_count` |
| public.detail_hides_private | `get_team_by_slug` | anon | `[]` |
| app.settings_audit | catalog | — | ≥1 `team.settings_updated` |
| app.immutable_fields | catalog | — | slug/game/owner unchanged |
| g1.player_directory | `search_player_directory` | anon | HTTP 200 unchanged |

## Limitation

Browser Playwright against live Next server actions was not run (no Teams write E2E suite; harness exercised the writer/action core). Cookie-bound `createTeamAction` wrapper is covered by unit wiring + identical writer calls.
