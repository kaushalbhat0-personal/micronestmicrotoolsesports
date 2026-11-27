# 03 — Teams Schema (P14-D3)

Implemented locally in:

- `20261114000001_p14_teams_foundation.sql`
- `20261114000002_p14_team_members.sql`
- `20261114000003_p14_team_audit_events.sql`

## Tables

### `teams`
Owner via `owner_user_id` (RESTRICT). One `game_key`. Unique slug. Levels/region CHECKs. `recruiting`, `is_public`, `lifecycle_status`. Immutable trigger on slug/game/owner/created_by/organization_id. Indexes for discovery + owner.

### `team_members`
PK `(team_id,user_id)`. Roles: `captain|co_captain|player|sub`. Status: `active|invited|applied|removed|left|suspended`. CHECKs for left_at and elevated-role⇒active. Helpers: `is_team_owner`, `is_team_active_member`, `is_team_captain` (owner OR active captain; co-captain excluded).

### `team_audit_events`
Append-only (UPDATE/DELETE trigger). No client policies. Events: `team.created`, `team.settings_updated`.

## Not implemented
Invitations, applications, recruitment_posts, transfer, member remove/appoint, `team_games`.
