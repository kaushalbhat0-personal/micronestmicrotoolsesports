# 07 — Application Contracts (G1)

Future location: `src/features/player-profile/` (does not exist yet — this document is the contract; no code in this phase).

## 1. Server-side use cases (all in Route Handlers / Server Actions, never client-direct writes)

| Use case | Actor | Inputs (Zod) | Effects |
|---|---|---|---|
| `ensureAppUser` | authenticated | — (uid from verified session only; no client-supplied ID) | Idempotent `app_users` bootstrap (`ON CONFLICT DO NOTHING` + re-select + status validation). APPROVED D-G1-01: authenticated owner client only; middleware never calls it; suspended blocked. |
| `createPlayerProfile` | authenticated | `{handle, display_name, bio?, country_code?, is_discoverable=false}` | Inserts `app_users` (if needed) + `player_profiles` transactionally. Handle lowercased, uniqueness error mapped to field error. `country_code` ISO alpha-2 only (D-G1-09). |
| `updatePlayerProfile` | owner | Partial `{display_name?, bio?, country_code?, avatar_path?}` (handle via separate throttled flow) | Owner-only UPDATE; `updated_at` via trigger. Mass-assignment guarded (see §3). |
| `setDiscoverability` | owner | `{is_discoverable: boolean}` (+ confirmation token/checkbox state) | Explicit consent toggle; logs intent (app log, no PII beyond uid). |
| `updateHandle` | owner | `{handle}` | Throttled (app rule, e.g., 30-day cooldown — D-G1-05), uniqueness enforced. |
| `upsertGameProfile` | owner | `{game_key, ign, game_user_id?, primary_role?, play_modes[], region_code?, availability[], is_visible}` | `ON CONFLICT (player_user_id, game_key) DO UPDATE` (owner-scoped). `region_code` validated against the applicable game-specific vocabulary (D-G1-09). |
| `removeGameProfile` | owner | `{game_key}` | Owner DELETE. |
| `deletePlayerProfile` | owner | confirmation | Deletes profile (cascades games) + avatar cleanup; keeps `app_users`. |
| `deleteAccount` | owner | confirmation + re-auth | Avatar cleanup → `app_users` delete (cascades) → Auth admin delete (service-role, last). |
| `searchDirectory` | anon/authenticated | `{game?, region?, role?, query? (bounded), limit 1..48, offset bounded ≥0}` | Calls `search_player_directory` RPC (RPC-only per D-G1-03; anon path, no base reads). |
| `getPlayerByHandle` | anon/authenticated | `{handle (^[a-z0-9_]{3,20}$)}` | Calls `get_player_by_handle` RPC; empty → 404 (no existence leak). |
| `getOwnProfile` | owner | — | Base-table SELECT own rows (RLS) for edit forms (full private fields). |

No use case reads others’ base rows. No service-role reads for others’ data (RPC covers it).

## 2. Validation boundaries (Zod)

- Every server entry validates with Zod before any DB/storage call. Client validation (React Hook Form + Zod inferred types) mirrors but never replaces server validation.
- DTOs: `CreatePlayerProfileInput`, `UpdatePlayerProfileInput` (explicit `.pick()`/`.omit()` — never `.passthrough()`), `GameProfileInput` (game-specific `region_code` vocabulary selected per `game_key`; never hardcoded into canonical identity — D-G1-09), `DirectorySearchInput` (limit 1..48, bounded offset ≥0 with server maximum, bounded query length, allowlisted `game`/`region`/`role` enums), `HandleInput` (`^[a-z0-9_]{3,20}$`, lowercased).
- Transforms: `handle.toLowerCase().trim()`, `ign.trim()`, extension canonicalization. Rejected: URLs in bio for discoverable profiles (app rule), HTML tags stripped.
- Errors: field-scoped `400` for validation/unique-handle; `401` unauthenticated; `403` non-owner (generic message, no existence hint for private handles); `404` indistinguishable for missing vs private; `409` handle taken (only on creation attempt with that handle — acceptable, handle availability is inherently enumerable; rate-limit the check endpoint).

## 3. Repository contracts (isolate Supabase client)

```ts
// Illustrative signatures only — not implemented in this phase.
// APPROVED D-G1-01: every `userId` argument below is server-derived from the
// verified session (auth.uid()). It is never accepted from client-controlled
// request data (body/query/params). Forged values are ignored (session wins).
interface PlayerProfileRepository {
  ensureAppUser(userId: string): Promise<AppUser>;
  getOwnProfile(userId: string): Promise<OwnProfile | null>;
  createProfile(userId: string, input: CreatePlayerProfileInput): Promise<PlayerProfile>;
  updateProfile(userId: string, patch: UpdateProfilePatch): Promise<PlayerProfile>;
  setDiscoverability(userId: string, value: boolean): Promise<void>;
  upsertGameProfile(userId: string, input: GameProfileInput): Promise<GameProfile>;
  removeGameProfile(userId: string, gameKey: string): Promise<void>;
  deleteProfile(userId: string): Promise<void>;
}
interface PlayerDirectoryReader {
  search(input: DirectorySearchInput): Promise<PublicPlayerCard[]>;
  getByHandle(handle: string): Promise<PublicPlayerCard | null>;
}
// DirectoryReader uses anon/authenticated client calling RPCs only (APPROVED D-G1-03: RPC-only).
// Repositories use the authenticated owner client (RLS) for normal bootstrap and owner CRUD.
// Service-role only for authorized administrative operations (Auth admin delete, suspension flips,
// seeding, signed URLs, cleanup). APPROVED D-G1-02: no repository writes `app_users.status`
// or any `app_users` column via an owner path.
```

Rules: repositories throw domain errors (`HandleTaken`, `NotOwner`, `Suspended`), never raw PostgREST errors to UI. No `select *`; explicit column lists. No service-role import outside `src/server/*` (existing guard retained; lint rule proposed in 09).

## 4. Route and component responsibilities

- `/onboarding` (authenticated): `ensureAppUser` + profile creation form. Redirect authenticated-with-profile away.
- `/players` (public directory): server component calls `searchDirectory` (RPC), renders cards (handle, display name, avatar, country, game/role/mode chips). No client fetch of base tables.
- `/players/[handle]` (public): calls `getPlayerByHandle`; `notFound()` on empty (no “private” variant). `generateMetadata` from projection only; robots `noindex` unless projection indicates indexable (see 04). SEO: handle-based canonical URL, no UID.
- `/settings/profile` (owner): `getOwnProfile` (base rows) + edit forms + consent toggles + danger zone (delete profile/account with double confirmation + re-auth).
- Components: presentational cards/forms (no Supabase imports); containers fetch via repositories/readers; error boundary + 404 shells already in app shell reused.

## 5. Error handling

- Unique-handle violation (`23505` on `lower(handle)`) → `409` field error “handle taken.”
- FK/CHECK violations → `400` with safe message (no DB detail leak).
- RLS denial (0 rows on owner op) → `403/404` generic (no distinction for private others).
- Storage failures → retryable `503` with idempotency guidance (same-path upsert safe to retry).
- Auth failures → redirect to login without leaking handle existence.

## 6. Public profile read flow (anon-safe)

```
Request /players/[handle]
 → Server Component validates handle (Zod)
 → DirectoryReader.getByHandle (anon-safe client → RPC get_player_by_handle)
 → 0 rows → notFound() (identical for missing/private/suspended)
 → 1 row (allowlisted columns) → render + metadata (noindex unless indexable)
```

No base-table query. No service-role. No UID in HTML (avatar URL contains UID path segment — acceptable: UID is unguessable random, path is the public object address; no email/IDs).

## 7. Authenticated profile edit flow (owner-only)

```
Request /settings/profile
 → require session (middleware getUser)
 → ensureAppUser (idempotent)
 → getOwnProfile (owner RLS SELECT own base rows)
 → Form (Zod client) → Server Action (Zod server)
 → Repository owner UPDATE (RLS USING/WITH CHECK auth.uid())
 → Avatar upload (if any): validate → storage upsert {uid}/avatar.ext → update avatar_path (same flow, storage-first ordering)
 → revalidatePath / redirect
```

Non-owners hitting edit routes get `403` (if handle known public) or `404` (if guessing UID paths — no UID routes exist).
