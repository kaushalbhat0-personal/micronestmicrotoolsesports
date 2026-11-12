# 07 — Cleanup and Final Verification (P14-D5)

## Cleanup

| Artifact | Action | Remaining |
| --- | --- | --- |
| Disposable auth users (`p14d5.*`) | Admin DELETE ×8 | **0** |
| `app_users` orphans | deleted | **0** |
| Test teams/members | deleted | **0** |
| Test audit events | deleted (trigger disabled only for that delete) | **0** |
| Audit trigger | re-enabled | active |

## Post-cleanup grants (still hardened)

| Function | anon EXECUTE | authenticated EXECUTE |
| --- | --- | --- |
| `create_team` | false | true |
| `update_team_settings` | false | true |
| `search_teams` / `get_team_by_slug` | true | true |
| `is_team_captain` | false | true |

## Ledger

Includes `20261114000001`–`00005` and `20261115000001`.

## Git / switches

- Staged legacy renames preserved (~1298 `R`)
- No commit / push / deploy
- All five write switches remain `false`
- LMS never accessed (`SUPABASE_PROJECT_REF` forced to Esports)
