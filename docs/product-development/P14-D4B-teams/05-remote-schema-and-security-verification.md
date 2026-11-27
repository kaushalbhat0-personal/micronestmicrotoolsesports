# 05 — Remote Schema and Security Verification (P14-D4B)

**Method:** elevated Management API SQL catalog inspection. **Not** JWT/PostgREST RLS proof.

## Schema

| Object | Verified |
| --- | --- |
| `teams` | 16 columns; unique slug; FKs to `app_users`/`games`; RLS on |
| `team_members` | PK `(team_id,user_id)`; role/status CHECKs; RLS on |
| `team_audit_events` | RLS on; append-only UPDATE/DELETE trigger |
| Indexes | discovery, owner, active members, audit team/created |

## Functions (all `SECURITY DEFINER`, `search_path=""`, owner `postgres`)

| Function | Present |
| --- | --- |
| `is_super_admin()` | Yes (F-A01) |
| `is_team_owner` / `is_team_active_member` / `is_team_captain` | Yes; captain = owner OR active `role='captain'` (co-captain excluded) |
| `search_teams` / `get_team_by_slug` | Yes; projection has `member_count`, no member identities |
| `create_team` / `update_team_settings` | Yes |

## Table grants (client)

| Table | anon/authenticated |
| --- | --- |
| `teams` | `authenticated` SELECT only |
| `team_members` | `authenticated` SELECT only |
| `team_audit_events` | **no** client grants (postgres/service_role only) |

No client INSERT/UPDATE/DELETE on Teams tables. Policies: SELECT-only for authenticated members/owners.

## Residual grant finding (documented)

Despite migration `REVOKE … FROM public` + `GRANT EXECUTE … TO authenticated`, remote `proacl` shows **`anon=X`** on mutation helpers and helpers (`create_team`, `update_team_settings`, `is_team_*`, `is_super_admin`), plus expected grants on public reads.

Likely cause: Supabase default privileges granting EXECUTE to `anon`/`authenticated`/`service_role` at CREATE time; revoke-from-`public` does not remove the explicit `anon` ACE.

**Mitigation already in function bodies:** mutations require `auth.uid()` + active account (+ verified email on create). Anon callers still fail closed at runtime logic. **Still a grant-hygiene debt** — explicit `REVOKE EXECUTE FROM anon` hardening migration recommended before write-switch enablement.

Public reads intentionally callable by anon.

## Data / ledger

- Row counts: teams/members/audits/app_users/auth.users = **0** (no user data mutated)
- Remote ledger = full 23-file active chain; no archived D1 Teams stamps
- G1 player projection functions unchanged and present

## Write switches (app — unchanged)

All remain `false`: WORKSPACE / ORGANIZER / TOURNAMENT / MODERATION / NEWS.
