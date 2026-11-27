# 03 — Authenticated Test Identities (P14-D5)

## Mechanism

Supabase Auth Admin API (`service_role`) created disposable users with metadata `p14_d5_test=true`. Passwords and JWTs were held in memory only and never written to docs.

Stamp: `20261113002813`  
Emails: `p14d5.{owner|captain|cocap|player|sub|unverified|suspended|outsider}.20261113002813@example.invalid`

| Role | Email confirmed at RPC time | `app_users.status` |
| --- | --- | --- |
| owner | yes | active |
| captain | yes | active |
| cocap | yes | active |
| player | yes | active |
| sub | yes | active |
| unverified | **no** (`email_confirmed_at` nulled after JWT issue) | active |
| suspended | yes | **suspended** (+ `suspended_at`) |
| outsider | yes | active |

## Unverified JWT method

GoTrue rejects password grant for unconfirmed emails. Procedure: confirm → sign-in → JWT → set `email_confirmed_at = null` → call RPCs. JWT remains valid; `create_team` checks live `auth.users` confirmation.

## Fixture seeding

Non-owner memberships inserted via elevated SQL (no invite RPC in scope). Teams created via owner JWT `create_team`.

## Cleanup

All 8 auth users deleted; teams/members/audits/app_users for stamp removed (audit trigger temporarily disabled for disposable delete only). Post-cleanup counts: auth/teams/members/audits/app_users = **0**.
