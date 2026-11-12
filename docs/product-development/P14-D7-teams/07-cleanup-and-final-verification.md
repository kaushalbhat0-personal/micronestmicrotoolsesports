# 07 — Cleanup and Final Verification (P14-D7)

## Cleanup

Stamp `20261113005330` fixtures removed:

| Asset | Result |
| --- | --- |
| Teams `p14d7-public-*` / `p14d7-private-*` | **0** remaining |
| `team_members` / `team_audit_events` for those teams | Deleted (audit triggers temporarily disabled for disposable delete only) |
| Auth users `p14d7.*.@example.invalid` | **6/6** deleted |
| `app_users` for those ids | Cleared |
| Temp credential files | Wiped |

Existing non-test data: untouched (ledger/project identity unchanged).

## Post-cleanup hardening

| Check | Result |
| --- | --- |
| Migration ledger | Still **24** local=remote through `20261115000001` |
| `create_team` EXECUTE | `authenticated` only (anon absent) |
| Write switches | Teams **true**; organizer/tournament/moderation/news **false** |
| Production deployment | Still `dpl_GFNDFjQCwPQmZcJDoJhoAQN2odwx` @ `376df8f` — unchanged |

## Tests after login fix

| Lane | Result |
| --- | --- |
| `tsc --noEmit` | PASS (after typedRoutes allowlist) |
| Vitest `src/features/teams` | **87/87** PASS |
| Full lint/build re-run | Preview build READY on deploy 3; local typecheck PASS |
