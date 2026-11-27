# 01 — Repository and Architecture Inventory

**Branch:** `new-platform` | **Date:** 2026-11-11 | **Mode:** read-only

## 1. Top-level structure

```
src/                  # greenfield app (113 files)
  app/                # routes (5 pages + 1 API + scaffolding)
  components/         # marketing/, shared/, ui/
  features/           # player-profile/ only
  lib/                # supabase/, canonical.ts, cn.ts, env.ts
  server/             # supabase-admin.ts, env.ts (privileged only)
  config/site.ts
  types/database.ts   # generated via `supabase gen types`
  middleware.ts
supabase/             # greenfield backend: config.toml, 9 migrations, seed.sql (empty)
e2e/home.spec.ts
public/.gitkeep       # only file; no marketing images/fonts in greenfield
ref/legacy-project/   # archive (1299 files): application/, supabase/, toolchain/, deployment/
docs/                 # architecture/, audits/, marketing-transformation/, product-discovery/
vercel.json           # no cron jobs (comment only)
next.config.ts        # typedRoutes, security headers, no redirects
package.json          # micronest-esports 0.1.0, node>=20.9.0
```

`tsconfig.json` excludes `ref/**`. `eslint` excludes `ref/**`. `src/features/README.md` forbids imports from `ref/legacy-project/`.

## 2. Application routes

| Route | File | Type |
|---|---|---|
| `/` | `src/app/page.tsx` | Static marketing, sections: ArenaHero, Ecosystem, PlayerDiscovery, AudiencePathways, BgmiBand, RoadmapStrip, ClosingCTA |
| `/about` | `src/app/about/page.tsx` | Static marketing, `served[]` + `availability[]` tables |
| `/players` | `src/app/players/page.tsx` | Public, `noindex`, filters `game/region/role/query`, Suspense + DirectoryResults |
| `/players/[handle]` | `src/app/players/[handle]/page.tsx` | Public, `noindex`, `revalidate=60`, `getPlayerByHandle`, 404-equivalence |
| `/settings/profile` | `src/app/settings/profile/page.tsx` + `actions.ts` | Authenticated owner only, `dynamic=force-dynamic`, `noindex,nofollow`, 5 server actions |
| `GET /api/health` | `src/app/api/health/route.ts` | Public healthcheck |
| scaffolding | `src/app/layout.tsx`, `error.tsx`, `not-found.tsx`, `sitemap.ts` (only `/`+`/about`), `icon.svg`, `globals.css` | — |
| middleware | `src/middleware.ts` → `src/lib/supabase/middleware.ts` (`updateSession`, no bootstrap, no redirect) | matcher excludes `_next/static|image|favicon|svg|png|jpg|jpeg|gif|webp` |

No `/teams`, `/organizations`, `/brands`, `/opportunities`, `/tournaments`, `/news`, `/tools`, `/games`, `/mini-games` routes exist.

## 3. Components / features / domain / server / API

- `src/components/marketing/`: `arena-hero.tsx`, `audience-pathways.tsx`, `bgmi-band.tsx`, `closing-cta.tsx`, `cta-button.tsx`, `ecosystem.tsx`, `player-discovery.tsx`, `roadmap-strip.tsx`, `section.tsx`, `marketing.test.tsx`
- `src/components/shared/`: `site-header.tsx` (primaryLinks `/players`, `/about` only), `site-footer.tsx` (links `/`, `/players`, `/about` + honesty statement), `container.tsx`
- `src/components/ui/button.tsx`
- `src/features/player-profile/`: `domain/` (app-user, avatar, directory, game-profile, player-profile, public-projection), `schemas/` (9 Zod boundaries), `server/` (avatar, completeness, consent, deletion, directory-reader, ensure-app-user, game-profile, game-visibility, handle, player-profile), `tests/` (27 files), `README.md`
- `src/lib/supabase/{client,server,middleware}.ts`, `src/lib/canonical.ts`, `src/lib/cn.ts`, `src/lib/env.ts` (public env names only), `src/lib/example.ts`
- `src/server/supabase-admin.ts`, `src/server/env.ts`
- `src/config/site.ts`: connected discovery ecosystem; public player discovery live, BGMI-first
- `src/types/database.ts` (generated), `src/types/index.ts`

## 4. Database integration

- Client: `@supabase/ssr@0.12.7` browser + server clients (`src/lib/supabase/`).
- Privileged: `src/server/supabase-admin.ts` (service-role, never imported from client components per `routes.test.ts` audit).
- Migrations: 9 files in `supabase/migrations/` (see §7). Live primary project `knniommcyyhbyiwljisk`: 4 tables, 7 RPCs, 3 buckets (verified read-only — see §7).
- No billing/entitlement/tournament/news/teams/orgs/brands tables in greenfield.

## 5. Auth integration

- Provider: Supabase Auth (`auth.uid()` only). No `src/lib/auth/` — identity lives in `server/ensure-app-user.ts` + per-operation `client.auth.getUser()`.
- No user-ID arguments accepted (anti-forgery). Middleware never bootstraps. Owners have no UPDATE on `app_users`.

## 6. Storage

- Buckets (live-verified): `public-avatars` (public, 512KB images, `{uid}/...` owner-scoped), `public-entity-media` (public, future entity artwork), `private-verification` (private, owner-only, zero feature wiring in G1).
- Env names only (`.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`. No values inspected.

## 7. Migrations (greenfield lineage)

| File | Scope |
|---|---|
| `20261110000001_foundation_baseline.sql` | `pgcrypto`, `handle_updated_at()`; zero product tables |
| `20261110000002_storage_foundation.sql` | 3 buckets + storage policies |
| `20261110000003_g1_identity_anchor.sql` | `app_users` + `ensure_app_user()` |
| `20261110000004_g1_identity_anchor_grant_tightening.sql` | revoke owner UPDATE on `app_users` |
| `20261110000005_g1_player_profile.sql` | `player_profiles` + `create_player_profile()` |
| `20261110000006_g1_game_catalogue.sql` | `games` (BGMI seed) + `player_game_profiles` |
| `20261110000007_g1_public_projection.sql` | `search_player_directory()`, `get_player_by_handle()` (frozen 12 cols) |
| `20261111000008_g1_owner_settings_lifecycle.sql` | discoverability, handle, deletion |
| `20261111000009_g1_handle_function_fix.sql` | handle fix |

Live applied migrations (primary): `foundation_baseline`, `storage_foundation`, `g1_identity_anchor`, `g1_identity_anchor_grant_tightening`, `g1_player_profile`, `g1_game_catalogue`, `g1_public_projection`, `g1_owner_settings_lifecycle`, `g1_handle_function_ambiguity_fix` — matches local lineage.

## 8. Tests

- Vitest (`vitest.config.ts`: `include src/**/*.test.ts(x)`, `pool:forks`): `src/lib/example.test.ts`, `src/components/marketing/marketing.test.tsx`, `src/app/players/_lib/query.test.ts`, `routes.test.ts`, `_components/components.test.tsx`, `src/features/player-profile/tests/` (27 files incl. 5 integration).
- Playwright: `e2e/home.spec.ts`, `playwright.config.ts`.
- No `__tests__/` in greenfield `src/`.

## 9. Build / deploy / dependencies

- `package.json` deps: `next@16.4.6`, `react@19.3.1`, `react-dom@19.3.1`, `@supabase/ssr@0.12.7`, `@supabase/supabase-js@2.119.0`, `zod@4.6.7`, `@radix-ui/react-dialog@1.3.1`, `@radix-ui/react-select@2.4.1`, `lucide-react@1.71.0`, `clsx@2.1.1`, `tailwind-merge@3.7.0`. No `dodopayments`, `razorpay`, `stripe`, `@vercel/analytics`.
- Scripts: `dev/build/start/lint/typecheck`, `test` (excludes integration), `test:all`, `test:integration`, `db:types`.
- `next.config.ts`: `typedRoutes:true`, `optimizePackageImports:[lucide-react]`, global security headers (`X-Frame-Options:DENY`, `X-Content-Type-Options:nosniff`, `Referrer-Policy:strict-origin-when-cross-origin`, `Permissions-Policy:camera=(),microphone=(),geolocation=()`).
- `vercel.json`: no builds/rewrites/crons — comment only.
- Current vs legacy: root is active greenfield; `ref/legacy-project/` is archive (`README.md` reference-only, `tsconfig` excluded); legacy cron preserved only under `ref/legacy-project/application/vercel.json`.
