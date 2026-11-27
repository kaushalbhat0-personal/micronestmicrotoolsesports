# 01 — Current State Audit

Evidence from repository inspection on `new-platform` @ `890e16c`. No live production dashboard mutations were performed. Schema facts come from migrations under `supabase/migrations/` and matching TypeScript contracts.

## 1. Application architecture (Verified)

### Feature module

`src/features/player-profile/` is feature-first:

| Layer | Role |
|---|---|
| `schemas/` | Zod boundaries (handle, profile, game, avatar, discoverability, …) |
| `domain/` | Contracts, onboarding status, access-policy soft gates, public-projection allowlist |
| `server/` | Injectable `SupabaseClient` ops (no `"use server"` in feature) |
| `share/` | Player Share Kit allowlist |
| `tests/` | Unit + integration |

App orchestration lives in:

- `src/app/onboarding/profile/` — create profile + first game profile
- `src/app/settings/profile/` — discoverability, game visibility, handle, completeness display, danger zone
- `src/app/players/` — directory + public handle route
- `src/app/players/_components/player-share-card.tsx` — Share Kit (uncommitted M1)

### Routes and data path

| Route | Auth posture | Data path |
|---|---|---|
| `/onboarding/profile` | Soft: `getUser()`; unsigned sees login CTA | `create_player_profile` RPC + game profile insert |
| `/settings/profile` | Soft: `getOwnProfile` throws → “Sign in…” | Owner table reads + consent/handle RPCs |
| `/players` | Public | `search_player_directory` |
| `/players/[handle]` | Public | `get_player_by_handle`; `dynamic = "force-dynamic"` (uncommitted M1-V fix) |

**Verified gap:** Middleware (`src/middleware.ts`) refreshes session only — it does **not** hard-gate `/settings/*` or `/onboarding/*`.

**Verified gap:** Settings has **no** general profile/game edit forms (IGN, role, region, modes, availability, `game_user_id`, bio/display name, avatar upload UI). Server ops exist for many of these; UI does not wire them.

### Completeness (Verified)

`src/features/player-profile/server/completeness.ts`:

> complete = handle + display_name + (avatar_path OR non-empty bio) + ≥1 game profile

Derived only; **no** DB flag; **no** discoverability side effect in this helper.

`domain/onboarding-status.ts`: `isVerified` always `false`.  
`domain/access-policy.ts`: `canClaimVerifiedIdentity` always denied; `canOptIntoDiscoverability` allows any status except `not_started` (does **not** require completeness today).

### Share Kit player card (Verified — M1 uncommitted)

`src/features/player-profile/share/player-card-model.ts` allowlist excludes `game_user_id`, email, UUIDs, verification flags. Bio omitted from PNG by design.

### Avatar (Verified)

- Bucket `public-avatars` — public read; owner path `{uid}/avatar.{ext}`; 512 KB; png/jpeg/webp  
  (`supabase/migrations/20261110000002_storage_foundation.sql`)
- Server module `src/features/player-profile/server/avatar.ts` + schemas exist
- **No** settings/onboarding UI action imports upload/remove yet

### Auth/session (Verified)

- Cookie SSR via `@supabase/ssr` (`src/lib/supabase/server.ts`)
- Feature ops use `client.auth.getUser()` (not caller-supplied user ids)
- Team create hard-gated by `email_confirmed_at` inside `create_team` RPC (separate from player completeness)

## 2. Supabase schema & projection (Verified)

### Tables

| Table | Migration | Notes |
|---|---|---|
| `app_users` | `20261110000003_…` | status active/suspended |
| `player_profiles` | `20261110000005_…` + `…08` | `is_discoverable` default **false**; handle unique |
| `games` | `20261110000006_…` | BGMI seeded |
| `player_game_profiles` | same | includes **`game_user_id`** (4–32 text), `is_visible` default true, availability array ≤7 |

### Frozen public projection — 12 fields (Verified)

Migration `20261110000007_g1_public_projection.sql` + `domain/public-projection.ts`:

1. handle 2. display_name 3. avatar_url 4. bio 5. country_code  
6. game_key 7. game_name 8. ign 9. primary_role 10. play_modes  
11. region_code 12. availability

**Omitted:** `game_user_id`, user ids, email, evidence, verification, timestamps.

Predicates: `is_discoverable` ∧ `is_visible` ∧ `app_users.status='active'` ∧ `games.is_active`.

### RLS / grants (Verified)

- Player base tables: **no** anon table SELECT; public via DEFINER RPCs only
- `is_discoverable` / handle not directly updatable via PostgREST — RPCs `set_player_discoverability`, `update_player_handle`
- `game_user_id`: owner RLS; omitted from public RPCs

### Storage (Verified)

| Bucket | Public | Limits | Policies |
|---|---|---|---|
| `public-avatars` | yes | 512 KB images | public SELECT; owner CUD on `{uid}/…` |
| `private-verification` | **no** | 5 MB images+pdf | owner INSERT/SELECT/DELETE on `{uid}/…`; **no** public read; **no** owner UPDATE policy |
| `public-entity-media` | yes | 2 MB | public SELECT; writes service_role-oriented |

Migration comment: reviewers use **service_role-signed URLs**, never public URLs.

### Reviewer / admin (Verified)

| Control | Status |
|---|---|
| `platform_admins` + `is_super_admin()` | Exists (`20261112000001_…`; active gate in `…02`) |
| `admin_audit_logs` append-only | Exists |
| App `requireSuperAdmin` / live audit writer | **Absent** — pure helpers only in `src/server/admin/audit.ts` |
| Dedicated player-verification reviewer role | **Absent** (super-admin only pattern) |
| Organizer `verification_cases` | Schema exists; policies deferred / inert |
| Player verification case table | **Absent** (policy only in P14-D12 docs) |
| Workspace moderation UI | Disabled shells |

### Teams privacy (Verified)

`get_team_by_slug` / `search_teams` return **`member_count`**, not member identities (`20261114000004_p14_team_public_rpcs.sql`).  
Team Share Kit (`src/features/teams/share/team-card-model.ts`) forbids roster/members keys.

### Discord (Verified)

- No Discord matches in `supabase/`
- No Discord OAuth in `supabase/config.toml` external providers (disabled stubs only)
- `src/` mentions are incidental (footer test forbids Discord URLs; roster paste keyword)
- Auth policy docs: email/password orientation (P14-D12)

### Rate limiting (Verified)

- Auth rate limits in `supabase/config.toml`
- Handle 30-day cooldown in RPC
- Public RPC LIMIT/OFFSET clamps
- **No** app-level directory/evidence submission rate-limit tables

## 3. Privacy guarantees checklist (Verified)

| Guarantee | Result |
|---|---|
| G1 public projection frozen at 12 fields | **Yes** |
| `game_user_id` owner-only / omitted from public RPCs | **Yes** |
| Public player reads RPC/projection-only | **Yes** |
| Public team profiles expose aggregate count, not identities | **Yes** |
| Team owners cannot read other players’ private evidence via public RPCs | **Yes** (no evidence API; private bucket owner-scoped) |
| Completeness currently gates discoverability in DB | **No** — gap vs locked M2 decision |
| Verification badge / evidence workflow live | **No** |

## 4. Prior policy continuity

`docs/product-development/P14-D12-auth-profile-verification/05-profile-verification-policy.md` already recommended admin-reviewed evidence via `private-verification` + future `player_verification_cases`. P15-M2A formalizes and extends that plan under locked product decisions.
