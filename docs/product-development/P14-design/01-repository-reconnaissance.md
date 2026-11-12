# 01 — Repository Reconnaissance (P14-B1 Phase 1)

Date: 2026-11-12. Branch: `new-platform`. WIP: 67 paths (9 modified + 58 untracked). Read-only; no files modified.

## 1. Route inventory (34 `page.tsx`)

Root: `src/app/layout.tsx` (single root layout), `page.tsx`, `error.tsx`, `not-found.tsx`, `icon.svg`, `sitemap.ts`, `globals.css`. No `loading.tsx` anywhere. No `apple-icon` / `opengraph-image`.

Public:
- `/` + `/about`
- `/players` + `/players/[handle]`
- `/teams` + `/teams/new` + `/teams/[slug]`
- `/organizations` + `/organizations/[slug]`
- `/organizers` + `/organizers/[slug]`
- `/brands` + `/brands/[slug]`
- `/tournaments` + `/tournaments/[slug]`
- `/news` + `/news/[slug]`
- `/tools` + `/tools/[slug]`

Settings: `/settings/profile`
Workspace teams: `/workspace/teams`, `/workspace/teams/[id]`, `/workspace/teams/[id]/roster`, `/workspace/teams/[id]/settings`
Workspace organizer: `/workspace/organizer`, `/workspace/organizer/tournaments`, `/workspace/organizer/tournaments/new`, `/workspace/organizer/tournaments/[id]/edit`
Workspace moderation: `/workspace/moderation`, `/workspace/moderation/tournaments`, `/workspace/moderation/reports`, `/workspace/moderation/organizers`
Workspace articles: `/workspace/articles`, `/workspace/articles/new`

API: `src/app/api/health/route.ts` (1 route).

Scoped errors (5): root + `organizers/[slug]`, `tournaments/[slug]`, `news/[slug]`, `tools/[slug]`.
Scoped not-found (6): root + `players/[handle]`, `organizers/[slug]`, `tournaments/[slug]`, `news/[slug]`, `tools/[slug]`.

Colocated per-route `_components/`, `_lib/query.ts`, `routes.test.ts`, `components.test.tsx`, `query.test.ts`.

## 2. Component architecture

- `src/components/shared/`: `site-header.tsx`, `site-footer.tsx`, `container.tsx` (`max-w-5xl`).
- `src/components/ui/`: `button.tsx` (single `primary|secondary` primitive).
- `src/components/marketing/`: `arena-hero`, `ecosystem`, `player-discovery`, `audience-pathways`, `bgmi-band`, `roadmap-strip`, `closing-cta`, `cta-button`, `section`, `marketing.test.tsx`.
- `src/features/`: 9 domains — `player-profile`, `teams` (+`roster/`), `tournaments`, `organizers`, `organizations`, `brands`, `news`, `moderation`, `tools` (`tiebreak/`, `roster/`, `prize-pool/`). Each: `domain/`, `schemas/`, `server/`, `tests/`, `README.md` (most).
- `src/lib/`: `canonical.ts`, `game-catalog/`, `cn.ts`. `src/server/admin/`. `src/config/site.ts`. `src/middleware.ts` (Supabase `updateSession`).

## 3. Layouts / navigation / IA

- `layout.tsx:20-27`: skip-link `#main-content`, `<header>`, `<main>`, `<footer>`.
- Header (`site-header.tsx`): 9 primary links (Discover players/teams/organizations/organizers, Tournaments, News, Tools, About) + Settings utility + `Explore players` CTA. Mobile: state-driven button `Menu/Close`, `md:hidden` panel. Sticky `top-0 z-40 bg-paper/95 backdrop-blur border-b`.
- Footer (`site-footer.tsx`): route index + honesty copy (Live vs Coming-soon).
- `sitemap.ts`: only `/` + `/about`; product routes noindex (intentional).

## 4. Tailwind v4 / tokens / fonts / icons / animation

- `src/app/globals.css` (96 lines): `@import "tailwindcss"`, single `@theme` (marketing-only). No JS config. Tokens: `arena-950 #0A0E14`, `arena-900 #111826`, `arena-800 #1C2534`, `arena-line`, `paper #FFF`, `steel-100 #F1F5F9`, `steel-200 #E2F0F0`, `ink-900 #0F172A`, `ink-600 #475569`, `steel-ink #334155`, `accent-600 #C8102E`, `accent-700 #A50D26`, `accent-300 #FF8A96`, `ghost #7E8CA0`, `font-display` Oswald-system-condensed stack. No spacing/radius/shadow/breakpoint tokens. `color-scheme: light` only. `.font-display` condensed utility. `prefers-reduced-motion` guard zeroes durations.
- Fonts: no `next/font`, no webfont, no local files. Display stack head-replaceable by licensed face.
- Icons: `lucide-react@1.71.0` installed but 0 usages in `src`. Only inline SVG: `icon.svg` (28px M-mark + red baseline) + `BrandMark` duplicate.
- Animation: no `motion`/`gsap`/`animejs`. Only `animate-pulse` skeletons + `hover:` (underline/bg/text). Zero `transition-*`/`duration-*`.

## 5. Assets

- `public/` = only `.gitkeep`. No logos/images/videos/OG. Only SVG: `src/app/icon.svg`. Avatars via `next/image` `player-avatar.tsx` (unoptimized, initials fallback).

## 6. WIP (67)

Modified (9): `.gitignore`, `package.json`, `e2e/home.spec.ts`, `globals.css`, `layout.tsx`, `page.tsx`, `site-footer.tsx`, `site-header.tsx`, `config/site.ts`.
Untracked (58): `AGENTS.md`, `e2e/tools/`, 12 `docs/` dirs, 11 `src/app/` dirs + `icon.svg`/`sitemap.ts`, `components/marketing/`, 9 `src/features/` dirs, `lib/canonical.ts`, `lib/game-catalog/`, `server/admin/`, 18 `supabase/migrations/*`.
Preserved; no commits/stash/modifications performed.

## 7. Tests / selectors

- Vitest 105 files (`src/**`): 99 unit, 6 integration (`player-profile/tests/*.integration.test.ts`). `test` = unit lane, `test:all` = all, `test:integration` = DB-backed (60s/180s timeouts).
- Playwright: `e2e/home.spec.ts` (2 tests) + `e2e/tools/{prize-pool,roster-builder,tiebreak}.spec.ts` (21 tests) + `helpers.ts`. Chromium-only, `baseURL localhost:3000`.
- Selectors: accessible-only (`getByRole/Text/Label`), 0 `data-testid`. `marketing.test.tsx` = static-only guard.

## 8. Source of truth

- Visual: `globals.css` (marketing) + Tailwind defaults (product); `site-header/footer`, `marketing/*`.
- Functional: per-route `_lib/query.ts` + `src/features/*/server/*-reader.ts` + `schemas/*` + colocated `routes/query/components` tests.
- Data: Supabase migrations `20261110–13*` (identity anchor → moderation queue → activation snapshots).
- Deferred: Mini Games — 3 marketing-only `Coming soon` mentions, 0 routes/features (see `features/README.md`, `roadmap-strip.tsx:13`).
