# 03 — Current Product Capabilities

**Source:** greenfield `src/` + live primary Supabase project `knniommcyyhbyiwljisk` (read-only). UI mockup vs functional distinguished by tests + DB verification.

## 1. Implemented features (functional)

### Identity anchor (G1-1)
- **Route:** none (bootstrap). **Dir:** `src/features/player-profile/server/ensure-app-user.ts`. **Backend:** `ensure_app_user()` RPC. **Tables:** `app_users(id=auth.uid(), status)`. **Auth:** authenticated only. **Tests:** `ensure-app-user.test.ts` + `ensure-app-user.integration.test.ts`. **Status:** working. Suspended users blocked (`SuspendedError`).

### Canonical player profiles (G1-2/G1-7)
- **Route:** `/settings/profile` (`src/app/settings/profile/page.tsx` + `actions.ts`). **Components:** `handle-section`, `discoverability-section`, `game-visibility-section`, `completeness-section`, `danger-zone-section`. **Backend:** `create_player_profile()`, `set_player_discoverability()`, `update_player_handle()`, owner DELETE policies. **Tables:** `player_profiles`. **Auth:** owner-only. **Tests:** `player-profile.test.ts`, `profile.test.ts`, `update-profile.test.ts`, `consent-*.test.ts`, `handle-*.test.ts`, `deletion-ops.test.ts`, `lifecycle.integration.test.ts`. **Status:** working, private-by-default (`is_discoverable DEFAULT false`).

### BGMI game profiles (G1-3)
- **Route:** `/settings/profile` (game-visibility section). **Dir:** `server/game-profile.ts`, `server/game-visibility.ts`. **Tables:** `games` (1 row: `bgmi`), `player_game_profiles`. **Auth:** owner-only. **Tests:** `game.test.ts`, `game-profile.test.ts`, `game-profile-ops.test.ts`, `game-visibility-ops.test.ts`, `game-profile.integration.test.ts`. **Status:** working. One row per (player, game). `country_code` optional ISO3166 (never `ONLINE`); `region_code` BGMI-only vocabulary.

### Public directory + profile pages (G1-4/G1-6)
- **Routes:** `/players` (`page.tsx`, `_lib/query.ts`, `_components/directory-*|player-card|player-avatar`), `/players/[handle]` (`profile-sections.tsx`, `revalidate=60`). **Backend:** `search_player_directory()`, `get_player_by_handle()` via `server/directory-reader.ts` (anon-safe, no base reads). **Projection:** frozen 12 cols (`handle,display_name,avatar_url,bio,country_code,game_key,game_name,ign,primary_role,play_modes,region_code,availability`) — never user IDs/email/`game_user_id`/timestamps. **Predicate:** `is_discoverable AND is_visible AND status='active' AND is_active`. **Auth:** public, 404-equivalence for missing/private/suspended/inactive. **Tests:** `directory.test.ts`, `directory-reader.test.ts`, `directory.integration.test.ts`, `query.test.ts`, `routes.test.ts`, `components.test.tsx`. **Status:** working.

### Avatar management (G1-5)
- **Route:** `/settings/profile`. **Dir:** `server/avatar.ts`, `domain/avatar.ts`, `schemas/avatar.ts`. **Storage:** `public-avatars` bucket (512KB images, `{uid}/...` owner-scoped, `avatar.jpg` canonicalization). **Tests:** `avatar.test.ts`, `avatar-ops.test.ts`, `avatar.integration.test.ts`. **Status:** working.

### Discoverability + handle + deletion lifecycle (G1-7/G1-8A/D-G1-10)
- **Backend:** `set_player_discoverability()`, `update_player_handle()` + cooldown, owner DELETE. **Auth:** verified-email gate before public discoverability (D-G1-10). **Status:** working. G1-8B onboarding pending (no signup CTA anywhere — enforced by tests).

### Marketing (M0/M1/M2/M4)
- **Routes:** `/` (7 sections), `/about` (problem/vision/BGMI/availability contract). **Dirs:** `src/components/marketing/*`, `src/components/shared/site-header.tsx` + `site-footer.tsx`, `src/config/site.ts`. **Status:** working, static, responsive/a11y/perf validated (screenshots + Lighthouse reports under `docs/marketing-transformation/M4-quality/`). No signup/join/register CTA. Marketing routes separate from authenticated functionality.

## 2. Explicitly not implemented (planned/docs-only)

Teams, organizations/brands, opportunities/applications, tournaments, news, mini-games — no routes, no tables, no UI. `src/features/README.md` + `src/app/sitemap.ts` + `marketing.test.tsx` (asserts absence of `/teams|/organizations|/brands|/opportunities|/tournaments|/news` hrefs) + `src/app/about/page.tsx:59` (Coming soon contract).

## 3. Live backend truth (read-only query 2026-11-11)

- Tables: `app_users` (0 rows), `player_profiles` (0 rows), `games` (1 row), `player_game_profiles` (0 rows). All RLS enabled.
- RPCs: `ensure_app_user`, `create_player_profile`, `search_player_directory`, `get_player_by_handle`, `set_player_discoverability`, `update_player_handle`, `handle_updated_at`.
- Buckets: `private-verification` (private), `public-avatars` (public), `public-entity-media` (public).
- No billing/entitlement/tournament/news/teams/orgs/brands objects.
