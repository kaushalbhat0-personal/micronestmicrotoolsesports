# 05 — Authorization Matrix (P14-D5)

Proven via JWT/PostgREST against remote `create_team` / `update_team_settings`.

## Settings update (`update_team_settings`)

| Actor | Result |
| --- | --- |
| Owner | **allowed** (200) |
| Active captain (non-owner) | **allowed** (200) |
| Co-captain | **denied** (403) |
| Player | **denied** (403) |
| Sub | **denied** (403) |
| Non-member | **denied** (403) |
| Cross-team IDOR | **denied** (403) |

Matches A1: owner + captain only; co-captain has no admin privileges.

## Create (`create_team`)

| Actor | Result |
| --- | --- |
| Anon | **denied** (401 — no EXECUTE) |
| Authenticated, unverified email | **denied** (403) |
| Authenticated, suspended account | **denied** (403) |
| Authenticated, verified, active | **allowed** (200) |
| Duplicate slug | **denied** (409) |

## Ownership / abandonment

| Check | Result |
| --- | --- |
| `owner_user_id` = creator | Proven on create |
| Direct PATCH transfer `owner_user_id` | Denied (403) |
| `transfer_team` RPC | Absent (404) |
| Last-owner leave/abandon path | Not exposed (no leave/transfer RPC) |
