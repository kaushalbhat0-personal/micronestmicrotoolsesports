# 02 — Anon Grant Hardening (P14-D5)

## Migration

- File: `supabase/migrations/20261115000001_p14_teams_grant_hardening.sql`
- SHA-256: `3A7D1A555B37839449CD125EB0EE9AA2E33F65D32F6C96303729EDC7B6704F1E`
- Applied: `npx supabase db push --linked --yes` → exit 0
- Ledger version: `20261115000001`

## First attempt (failed, rolled back)

Included `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin …` → `42501 permission denied`. Entire transaction rolled back; grants unchanged. Migration narrowed and re-applied.

## Target grants

| Entrypoint | anon | authenticated |
| --- | --- | --- |
| `search_teams`, `get_team_by_slug` | EXECUTE | EXECUTE |
| `create_team`, `update_team_settings` | **revoked** | EXECUTE |
| `is_team_*`, `is_super_admin` | **revoked** | EXECUTE (RLS callers) |
| Trigger helpers | revoked | revoked |

## Default privileges

- `postgres` in `public` functions: anon/PUBLIC EXECUTE **revoked** (authenticated + service_role retained).
- `supabase_admin` defaults: **unchanged** (login role cannot alter). Residual: future objects created as `supabase_admin` may still auto-grant anon — mitigate with explicit revokes in each migration.

## After (verified)

| Function | anon_x | auth_x |
| --- | --- | --- |
| `search_teams` | true | true |
| `get_team_by_slug` | true | true |
| `create_team` | **false** | true |
| `update_team_settings` | **false** | true |
| `is_team_captain` | **false** | true |
