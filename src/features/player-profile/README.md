# player-profile — G1 Identity & Player Profile (G1-5: avatar storage wiring live)

G1-1 scope: `app_users` anchor + `server/ensure-app-user.ts` lazy bootstrap.
G1-2 scope: `player_profiles` canonical table + `server/player-profile.ts`
(get/create/update own profile, session-derived identity, atomic creation via
`create_player_profile()`).
G1-5 scope: avatar upload/replace/remove against the existing
`public-avatars` bucket (D-G1-06 Option A: canonicalize `jpeg→jpg`; no new
buckets/policies/migrations) + hardened DirectoryReader avatar resolution
(fail closed on non-allowlisted shapes, NULL stays NULL) +
`server/avatar.ts`, `domain/avatar.ts`, extended `schemas/avatar.ts`.
G1-4 scope: `search_player_directory` + `get_player_by_handle` RPCs
(frozen 12-column output, D-G1-03 + D-G1-04 Option A) +
`server/directory-reader.ts` (anon-safe reader, no base reads for others).
G1-3 scope: `games` catalogue (BGMI seed, public reads, migration-controlled
writes) + `player_game_profiles` (one row per player×game, owner RLS) +
`server/game-profile.ts` (list/read/create/update own game profiles). No
routes, no UI (routes ship in G1-6 outside this feature dir).

## Domain responsibility

- Single application identity per authenticated user (`app_users.id = auth.uid()`).
- At most one canonical player profile per user (`player_profiles.user_id`).
- Many game profiles per player (`player_game_profiles`), one row per `(player, game)`.
- BGMI-first catalogue (`games.key = 'bgmi'`); new titles are catalogue rows, never a canonical-schema redesign.

Authoritative: `docs/architecture/g1-identity-player-profile/01`–`11`, especially
`11-decision-freeze.md`. This README is a scaffold index, not a second source of truth.

## What belongs here

- `schemas/` — Zod input boundaries only (no DB calls). Each schema cites its
  authoritative field definition (03/05/07).
- `domain/` — frozen, logic-free contract constants (public-projection allowlist)
  plus the minimal `AppUser` identity contract and domain errors.
- `server/` — server-only operations (`ensureAppUser`: session-derived identity,
  owner client, no service-role; `player-profile`: get/create/update own
  profile, no user-ID parameter, atomic creation RPC). Never imported from
  client components.
- `tests/` — pure Vitest validation tests (no Supabase required) plus mocked
  operation tests (fake client, no network).

## What explicitly does NOT belong here

- Signup bootstrap beyond `server/ensure-app-user.ts` (onboarding wiring is G1-7).
- Migrations, tables, RLS policies, projection RPCs beyond G1-1 scope.
- Service-role usage or admin clients (`src/server/*` stays outside this feature).
- Public routes (`/players`, `/players/[handle]`) and UI components live in
  `src/app/players/` (G1-6), reading exclusively through
  `server/directory-reader.ts`. They are intentionally not part of this
  feature dir.
- Verification badges, skill scores, ranks, K/D (forbidden in G1).
- Teams, organizations, brands, vacancies, DMs, feeds, payments (future domains).

## Approved relationships (D-G1-01, D-G1-02 frozen)

- Identity comes exclusively from the verified session (`auth.uid()`).
  Repository `userId` arguments are always server-derived, never client input.
- Normal bootstrap uses the authenticated owner client. Middleware never bootstraps.
- Owners have no UPDATE on `app_users`; `status`/flags change only through the
  authorized administrative boundary. Owner edits live in profile/game tables.

## Public/private boundary (D-G1-03 frozen, RPC-only)

- Only `search_player_directory` + `get_player_by_handle` expose other users' data.
- Frozen output (`domain/public-projection.ts`):
  `handle, display_name, avatar_url, bio, country_code, game_key, game_name,
ign, primary_role, play_modes, region_code, availability`.
- Never public: user IDs, email, private identifiers, `game_user_id` (all
  forms), evidence, precise timestamps (omitted). No `SELECT *`.
- Effective row predicate:
  `is_discoverable AND is_visible AND status='active' AND is_active`.
- 404-equivalence: missing, private, suspended and inactive handles are
  indistinguishable.

## Consent model (private by default)

- `is_discoverable DEFAULT false`; per-game `is_visible DEFAULT true` is inert
  until the master switch is on. Creation forces undiscoverable; publishing is a
  separate explicit `setDiscoverability` action, never implied by a client flag.
- Revocation is immediate in query results; external de-indexing is best-effort.

## Game-specific separation (D-G1-09 frozen)

- `country_code`: optional ISO 3166-1 alpha-2; never `ONLINE`.
- `region_code`: per-game vocabulary selected by `game_key`. The BGMI vocabulary
  in `schemas/game.ts` is BGMI-only and must never be treated as universal.
- Game-specific validation must not be hardcoded into canonical identity.

## Future integration boundaries

- Future `team_members(user_id)`, `organization_members(user_id)`,
  `brand_representatives(user_id)` FK to `app_users(id)`. No per-entity auth.
- Future vacancies/opportunities reference `games(key)`.

## Deferred decisions (must NOT be assumed)

- D-G1-04 omit vs masked `game_user_id` (CLOSED 2026-11-11: Option A — omit
  in all forms; no search/filter/dedup; no verification claim).
- D-G1-05 handle throttle limits (no rate limit invented here).
- D-G1-06 avatar canonicalization (CLOSED as implementation detail: Option A
  — image/jpeg stores as avatar.jpg; no product approval required, no
  migration; see G1-5 report).
- D-G1-07 deletion grace (no delete flows here).
- D-G1-08 completion definition (no derived flag here).
- D-G1-10 email-confirmation gate (no discoverability gate here).
- D-08 moderation, D-09 application caps (out of G1).
