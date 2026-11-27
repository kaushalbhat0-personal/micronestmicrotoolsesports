# 01 — Current State Inventory

**HEAD:** `890e16c` on `new-platform` (tracks `origin/new-platform`)  
**`origin/main`:** `376df8f` (unchanged)  
**Working tree at audit start:** untracked `docs/product-development/P14-D14-onboarding-acceptance/` only (preserved)

## Stack (VERIFIED — `package.json`)

| Package | Version |
|---|---|
| Next.js | 16.4.6 (App Router) |
| React | 19.3.1 |
| TypeScript | 5.9.3 |
| Tailwind CSS | 4.3.5 |
| Zod | 4.6.7 |
| `@supabase/ssr` | 0.12.7 |
| Vitest / Playwright | 3.2.7 / 1.65.0 |

Package manager: **npm**. No Docker in current workflow.

## Architecture (VERIFIED)

Feature-first modular monolith under `src/features/*` with thin `src/app` orchestration.  
`legacy/` is reference-only and must not be imported at runtime.

Features present: `player-profile`, `teams`, `tools`, `tournaments`, `organizers`, `news`, `brands`, `organizations`, `moderation`.

## Route inventory (new platform)

### Functional / live data path — VERIFIED

| Route area | Status | Notes |
|---|---|---|
| `/`, `/about` | Marketing live | Static; OG text only, no images |
| `/signup`, `/login`, `/forgot-password`, `/auth/callback`, `/logout` | Auth live | Frictionless email/password |
| `/onboarding/profile` | Live | G1 create profile + BGMI game profile |
| `/settings/profile` | Live | Discoverability, handle, deletion; incomplete edit surfaces |
| `/players`, `/players/[handle]` | Live | Public RPCs + opt-in directory |
| `/teams`, `/teams/[slug]`, `/teams/new` | Live | Public RPCs + soft create gate |
| `/workspace/teams/*` | Live | Member-gated reads; settings writes via RPC |
| `/tools`, `/tools/[slug]` | Live | 3 available tools, client-only |

### Partial / shell — PARTIAL

| Route area | Status | Notes |
|---|---|---|
| `/tournaments*`, `/organizers*` | UI + migrations/RPCs | Readers still carry some stale “unapplied” commentary; treat as PARTIAL until ops confirm prod apply |
| `/workspace/organizer*`, `/workspace/moderation*` | UI present | Depends on organizer/moderation activation posture |
| `/news*`, `/workspace/articles*` | UI + schemas | **No** article migrations; writes disabled |
| `/brands*`, `/organizations*` | UI + readers | **No** migrations/RPCs |

## Env var names only (VERIFIED — `.env.example` + `src`)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `G1_TEST_MODE` (tests only)

Values never printed in this audit.

## Design system — PARTIAL

- Tokens: `src/app/globals.css` `@theme` (Arena palette, accent crimson, Oswald/Geist).
- UI primitives: effectively **Button-only** under `src/components/ui/`.
- Shared shell: header/footer/container + marketing sections.
- Forms often use local Tailwind classes rather than shared Input/Card primitives.

## Tests — VERIFIED

- Unit lane: large Vitest suite (≈104 files / 1025 tests observed in recent P14-D14 run).
- Integration lane: player-profile / teams contracts (gated by env / embedded Postgres).
- E2E: Playwright present; product acceptance historically run against Preview.

## What must not be disturbed

1. G1 public projection contracts and omitted private fields.
2. Teams RPC hard gates (`email_confirmed_at`, owner/captain checks).
3. Tools’ client-only privacy posture (no silent server telemetry).
4. Honest empty states / no fabricated directory content.
5. “Complete ≠ verified” onboarding language.
6. Legacy isolation and LMS project isolation.

## Deferred / disabled (VERIFIED or documented)

| Item | Classification |
|---|---|
| Mini Games | Deferred (product rule) |
| Tool “coming-soon” registry entries | Infrastructure ready; registry empty |
| News writes (`NEWS_WRITES_ENABLED = false`) | Disabled |
| Team open-slot / applications tables | Deferred (orphan UI + Zod) |
| Player verification badges | Forbidden by design until admin path |
| Product route SEO indexing | Intentionally `noindex` + sitemap excludes them |
