# 02 — Identity Architecture

## 1. Auth-to-application identity relationship

```
auth.users (Supabase Auth, managed schema)
  │ 1:1, PK auth.users.id (uuid, gen_random_uuid via pgcrypto)
  ▼
public.app_users (proposed, owned by G1)
  │ PK id uuid REFERENCES auth.users(id) ON DELETE CASCADE
  │ — id doubles as application user id; no separate serial id
  ▼
public.player_profiles (proposed, 1:1)
  │ PK user_id REFERENCES app_users(id) ON DELETE CASCADE
  ▼
public.player_game_profiles (proposed, 1:N per player × game catalogue)
```

Rules:
- Single authentication identity. No per-entity auth accounts. Teams/orgs/brands never get `auth.users` rows; they get membership rows pointing at `app_users.id`.
- `app_users.id` IS the `auth.users.id` (same UUID). This avoids a mapping table, keeps RLS predicates as `auth.uid() = id`, and lets future `team_members(user_id)`, `organization_members(user_id)`, `brand_representatives(user_id)` all FK to one stable key.
- `auth.users` is managed by Supabase; G1 creates no triggers in `auth` schema. The legacy `handle_new_user` trigger pattern (trigger on `auth.users` calling `public` function) is rejected per APPROVED D-G1-01 and is not an active option: it couples managed-schema lifecycle to app logic, creates orphan rows on abandoned signups, and complicates `db reset` semantics. Frozen position: explicit lazy initialization only.

## 2. Account lifecycle

States for `app_users` (proposed `status`: `active | suspended | deleted-pending` — actual deletion removes the row; see §5):

1. `auth signup` → `auth.users` row exists, NO `app_users` row yet. User is authenticated but has no application identity. App treats as “onboarding required.”
2. First authenticated app action (e.g., opening `/onboarding` or creating player profile) → server action checks `app_users` by `auth.uid()`; if missing, inserts `(id = auth.uid(), created_at, status='active')` in the same transaction as player-profile creation (or as a prerequisite step). Idempotent via `INSERT ... ON CONFLICT (id) DO NOTHING` + re-select. APPROVED D-G1-01 safeguards: identity comes exclusively from the verified session (`auth.uid()`); no caller-controlled user ID; PK uniqueness + conflict handling provide concurrency safety; the bootstrap re-selects and validates the resulting account status (see §3); a suspended row never passes initialization (blocked with a generic error); initialization failure leaves the account recoverable (onboarding-required, retryable).
3. Active: full CRUD on own rows per RLS.
4. Suspended (future admin): `status='suspended'` set via the explicitly authorized administrative boundary (service-role admin path) only. RLS write policies require `status='active'` via inline `EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND status = 'active')` — no DEFINER helper (see 05 §6). Discovery projection filters `status='active'` (full predicate in 04 §2 / 05 §5).
5. Deletion: user-requested account deletion → server flow deletes `app_users` row (cascades to player + game profiles per FK), cleans avatar objects via storage API, then calls Auth admin `deleteUser` (service-role) to remove `auth.users`. Order matters: app data first, auth last, so a failure leaves the account recoverable.

Why lazy, not trigger (APPROVED D-G1-01 — trigger is not an active option):
- No function/trigger in `auth` schema to maintain across resets.
- No orphan `app_users` for users who verify email but never onboard.
- Signup email-confirmation setting (`enable_confirmations=false` in dev) does not gate identity creation; product may later require verified email before discoverability (U1 in 01) without changing identity plumbing.

## 3. Signup initialization

Sequence (server actions only, never client direct table writes for identity bootstrap; middleware never invokes bootstrap):

1. Supabase Auth signup/sign-in (email OTP/magic link per baseline; no OAuth in G1).
2. Middleware refreshes session (`updateSession` already in shell). Middleware performs no database writes and never calls `ensureAppUser`.
3. Onboarding server action `ensureAppUser()`:
   - `SELECT id, status FROM app_users WHERE id = auth.uid()` using the authenticated owner client (RLS-owned SELECT — owner can read own row). Unrestricted service-role bootstrap is forbidden; service-role is limited to authorized administrative operations.
   - If missing: `INSERT INTO app_users (id) VALUES (auth.uid()) ON CONFLICT DO NOTHING`, then re-select and validate the resulting row.
   - Returns `{ status }`; if `suspended` (whether the row pre-existed or was just created in a race), block onboarding with generic error (no enumeration). Suspended users cannot pass initialization merely because their row exists.
4. Profile creation action `createPlayerProfile(input)` validates Zod, then inserts `app_users` (if needed) + `player_profiles` transactionally. Handle uniqueness enforced by DB unique index on `lower(handle)` (see 05), surfaced as field error.

No placeholder handles, no auto-drafted profiles. Completion is user-driven.

## 4. Future entity relationship model (contract, not implementation)

One user, many memberships:

```
app_users (1) ──< player_profiles (0..1, G1)
            ──< team_members (0..N, future)
            ──< organization_members (0..N, future; role owner|admin|recruiter)
            ──< brand_representatives (0..N, future; verified flag)
```

- All future membership tables: `user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE`, plus entity FK, role, timestamps. RLS: owners read own memberships; entity-scoped reads via membership EXISTS checks (never broad).
- Permissions are membership rows + role columns, not new auth identities, not custom Postgres roles per user. Custom Postgres roles remain unused (managed-cluster concern; `db reset --remote` preserves roles — no per-user roles).
- Game catalogue (`games`) is referenced by game profiles now and by future vacancies/opportunities later (`game_key TEXT REFERENCES games(key)`), so discovery stays consistent across domains.

## 5. Account suspension/deletion

Suspension (schema reserved, workflow future; APPROVED D-G1-02 — no owner UPDATE on `app_users`):
- Column `app_users.status` + `suspended_at`, `suspension_reason` (private, never projected).
- Writes blocked by RLS (`WITH CHECK` / `USING` requiring `status='active'`).
- Reads of own data still allowed (so user can appeal/export); discovery projection excludes suspended.
- Only an explicitly authorized administrative boundary (service-role admin path) mutates `status`; no client-writable policy on `status`. Owners cannot change account status, privileged flags or administrative attributes. Owner profile editing belongs in `player_profiles` / `player_game_profiles`, not `app_users`.

Deletion:
- Player-profile-only deletion: `DELETE FROM player_profiles WHERE user_id = auth.uid()` → cascades to `player_game_profiles`; `app_users` row remains; avatar objects for player removed (app-driven storage cleanup; RLS owner-delete already allows it).
- Full account deletion: server flow (authenticated, confirmed): delete avatar objects → delete `app_users` row (DB cascades handle player + game profiles) → Auth admin delete. Audit log entry via service-role (future audit domain; G1 notes the hook, does not build audit tables).
- No soft-delete for player data beyond explicit `deleted-pending` grace if product requires it (open decision D-G1-07 in 10). Default: hard delete on confirmation.

## 6. Verification boundaries

- Email/phone verification lives in Auth (OTP length/expiry per baseline). G1 does not duplicate verification state in app tables, except future discoverability gate may require `auth.users.email_confirmed_at IS NOT NULL` checked server-side (not stored).
- Game-profile “verification” (skill/identity proof) is NOT part of G1. No `verification_status` writes in G1 flows; the column name is reserved for a later verification domain to avoid a future rename. G1 game profiles are explicitly self-declared; UI must not render badges.
- Avatar/evidence review (moderation) is future (D-08). G1 ensures evidence stays private (`private-verification` bucket, owner-only policies already deployed) and reviewer access is via signed URLs (service-role), never base-table reads from browser.
