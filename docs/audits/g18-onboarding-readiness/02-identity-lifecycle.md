# 02 — Identity Lifecycle Audit (verified 2026-11-11)

All statements below are verified against remote read-only inspection plus
the current local source/migrations. Historical reports are cited only as
provenance, never as a substitute for re-verification.

## 1. Current identity flow

1. User signs in via Supabase Auth (no app UI yet — G1-8B scope).
2. First authenticated app action calls `ensureAppUser(client)` with the
   authenticated owner client (`src/features/player-profile/server/ensure-app-user.ts:36`).
3. `ensureAppUser` takes ONLY a `SupabaseClient` (arity is the proof — no
   user-ID argument exists, so caller-supplied IDs are inexpressible), reads
   identity exclusively from `client.auth.getUser()`, and calls the
   single-statement INVOKER RPC `public.ensure_app_user()`.
4. The RPC does `INSERT … ON CONFLICT (id) DO NOTHING` + re-select in one
   transaction with `SET search_path = ''` (live-verified: `is_definer false`,
   `search_path=""`, result columns include `id, status, …`).
5. `ensureAppUser` asserts exactly one row, asserts `row.id === user.id`
   (fail-closed on mismatch), then gates `status === 'active'`
   (`ensure-app-user.ts:56-72`). Anything else throws `SuspendedError`
   (generic message) or recoverable `BootstrapError`/`UnauthenticatedError`.

## 2. Bootstrap behavior (VERIFIED)

- Lazy only: integration tests in every G1 report prove no `app_users` row
  exists at signup; creation happens on first explicit action. No
  `auth`-schema trigger was introduced (migration inventory is `public`-only).
- Idempotent + concurrency-safe: PK `app_users(id)` + `ON CONFLICT DO NOTHING`
  in one statement. G1-1 live lane proved 5-way concurrent bootstrap → 1 row.
- Grants: `authenticated` holds SELECT/INSERT/DELETE on `app_users` at table
  level (live-verified `role_table_grants`); UPDATE was revoked
  (G1-1 tightening; absent from grants). RLS allows only owner SELECT and
  owner INSERT `WITH CHECK (id = auth.uid())` — no owner UPDATE, no owner
  DELETE, no anon policies (live-verified `pg_policies`, 2 policies).
- Suspended handling: suspended fixture → `SuspendedError` with generic
  message `Account unavailable. Contact support if this persists.`
  (`domain/app-user.ts:30-37`); owner UPDATE to `suspended` denied at grant
  layer (42501 per G1-1 live lane); re-select returns the fresh row so a
  mid-flow suspension is still enforced.
- No middleware writes: `src/middleware.ts` → `updateSession()` only calls
  `auth.getUser()` and refreshes cookies (`src/lib/supabase/middleware.ts:26`).
  No `ensureAppUser`, no RPC, no `.from().insert()` in the middleware path.
- Unauthenticated requests cannot create identities: anon holds no grants on
  `app_users` (absent from `role_table_grants` for anon); INSERT policy is
  `authenticated`-only with `auth.uid()`; `ensureAppUser` without session
  throws `UnauthenticatedError` before any RPC.
- Unconfirmed-user behavior: **no email-confirmation check exists anywhere**.
  Grep `email_confirmed|email_confirm|confirm.*email` over `src/` = zero
  matches; `ensure_app_user()` body references neither `auth.users` nor
  `email_confirmed_at`; `create_player_profile()` gates on `app_users.status`
  only. Consequence: if Auth allows sign-in without confirmation, an
  unconfirmed user CAN bootstrap `app_users` and create player/game profiles
  today. This is the D-G1-10 gap, not a regression — closing it is the
  D-G1-10 decision (see `04-dg1-10-decision-brief.md`).

## 3. Session and confirmation implications

- Signup → session establishment is governed entirely by the UNVERIFIED
  remote Auth settings (confirmation on/off, autoconfirm). The app layer adds
  no second gate today.
- Profile creation is correctly gated by authenticated session + database
  constraints regardless of confirmation: `create_player_profile()` requires
  `auth.uid()`, an existing `app_users` row, `status = 'active'`, and returns
  forced `is_discoverable = false`. Unauthorized creation is denied at RLS
  (live-proven: cross-user INSERT denied, anon denied).
- Public discovery stays closed until explicit opt-in: creation forces
  undiscoverable; publishing requires the dedicated DEFINER
  `set_player_discoverability()` (authenticated-only EXECUTE, active-gated),
  because column grants deny direct `is_discoverable` writes
  (live-verified `role_column_grants`: UPDATE on `player_profiles` covers
  only `display_name, bio, country_code, avatar_path, updated_at`).
- Nothing in this lifecycle needs weakening for onboarding: the confirmation
  gate, when approved under D-G1-10, is additive (a session/claim check in
  `setDiscoverability` and/or a documented reliance on Auth-level
  confirmation), never a relaxation of `auth.uid()` binding, RLS, or grants.
