# 01 — Reviewer authorization

## Primitives (verified)

| Object | Role |
| --- | --- |
| `platform_admins` | Membership table; `user_id` = `app_users.id` |
| `is_super_admin()` | `SECURITY DEFINER`; `platform_admins` ∩ `app_users.status = 'active'` |
| App gate | `src/lib/auth/require-super-admin.ts` → `getUser()` then `rpc('is_super_admin')` |

## Enforcement points

1. **Page** `/workspace/moderation/bgmi-ownership` — `requireSuperAdmin` before queue render; unauthenticated → sign-in; forbidden → deny copy.
2. **Server actions** — call `decideBgmiOwnershipCase` / `mintReviewerBgmiOwnershipEvidenceSignedUrl`, which call `requireSuperAdmin` first.
3. **RPC** `decide_player_bgmi_ownership_case` / `list_pending_bgmi_ownership_cases` — re-check `is_super_admin()` and `auth.uid()`.
4. **Self-review ban** — RPC raises `cannot review own case` when `case.player_id = auth.uid()`; app maps to `BgmiOwnershipForbiddenError`. Decisions table CHECK `reviewer_id <> player_id`.

## Explicit non-goals

- No new reviewer role system (existing primitives sufficient).
- No client-supplied reviewer ID or role flag.
- Team owners get no evidence access (unchanged Storage/metadata RLS).

## Pre-implementation finding

`platform_admins` may be empty in environments without seeded owners. Reviewer tests bootstrap a temporary membership via service-role and delete it in `afterAll`. Production review requires an authorized owner grant outside this milestone.
