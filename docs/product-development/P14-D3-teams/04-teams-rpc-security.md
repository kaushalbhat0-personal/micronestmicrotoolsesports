# 04 — Teams RPC Security (P14-D3)

## Public reads (`20261114000004`)

| RPC | Grants | Notes |
| --- | --- | --- |
| `search_teams` | anon + authenticated | public+active; escaped ILIKE; limit/offset clamps; active `member_count` |
| `get_team_by_slug` | anon + authenticated | same predicate; + description; empty ≡ private/missing |

Never returns owner/member identities.

## Mutations (`20261114000005`)

| RPC | AuthZ | Behavior |
| --- | --- | --- |
| `create_team` | `auth.uid()` + active `app_users` + `email_confirmed_at` | Insert team (owner=created_by=uid) + captain active membership + `team.created` audit |
| `update_team_settings` | active + `is_team_captain` (owner OR active captain) | Allowlisted fields only; `team.settings_updated` audit |

## RLS / grants

- `teams` / `team_members`: SELECT for authenticated via helpers; no client INSERT/UPDATE/DELETE
- `team_audit_events`: no client policies; append-only trigger
- Helpers: DEFINER, `search_path=''`, execute to authenticated

## Deferred (absent)

transfer, leave, remove, appoint, recruitment/application RPCs
