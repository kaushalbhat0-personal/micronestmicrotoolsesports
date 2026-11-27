# 02 — Target Architecture (P14-C1)

Status: **Proposed** (assessment only; no broad rewrite executed).
Principle: keep feature-first modular monolith; no microservices, no premature abstraction.

## 1. Proposed root structure (retain; only `ref/` → `legacy/` changes)

```
MicroNest MicroTools - Esports/
  src/
    app/                    # orchestration only (~15 lines/page: context → service → pass → render)
    features/<slug>/        # domain capability (see §2)
    lib/                    # cross-cutting infra (auth, supabase, env, validation, canonical, game-catalog)
    server/                 # repositories/services/admin boundary (see §3)
    components/ui|shared|layout|marketing/
    config/                 # site/app config
    types/                  # Database + shared types
    middleware.ts           # updateSession only
  supabase/
    migrations/             # fresh chain only (see 05-clean-migration-plan.md)
    config.toml / seed.sql  # PG17, empty seed
  legacy/                   # PROPOSED rename of ref/legacy-project/ (see 01 §7)
    README.md / application/ / database/ / documentation/ / configuration/ / tooling/
  docs/architecture/legacy-isolation/  # this package
  e2e/ / public/ (.gitkeep) / scripts/ (empty)
  next.config.ts / tsconfig.json / eslint.config.mjs / vitest.config.ts / playwright.config.ts / vercel.json
```

No new top-level dirs created. `scripts/` stays empty (no placeholder files).
`public/` stays `.gitkeep` until real assets land (marketing is code-only).

## 2. Feature ownership

| Feature slug | Routes owned | `features/` owned | DB owned (see 04) | Notes |
|---|---|---|---|---|
| `player-profile` (G1 live) | `/players`, `/players/[handle]`, `/settings/profile` | `features/player-profile/{domain,schemas,server}` | `app_users`, `player_profiles`, `games`, `player_game_profiles`, buckets `public-avatars`/`private-verification` | Only RPC + owner-RLS reads; `ensure_app_user` lazy bootstrap |
| `teams` (P1/P2, D1 pending) | `/teams`, `/teams/[slug]`, `/teams/new` (validation-only), `/workspace/teams/**` | `features/teams/{domain,schemas,services/search,roster/*,server}` | PROPOSED `teams/team_members/recruitment_posts/applications/reports` + `search_teams/get_team_by_slug` | Writes disabled (`WORKSPACE_DISABLED_MESSAGE`); roster is stateless local-only |
| `tournaments` (P3/P9 pending) | `/tournaments`, `/tournaments/[slug]`, `/workspace/organizer/tournaments/**` | `features/tournaments/*` | PROPOSED `tournaments` + `search_tournaments/get_tournament_by_slug` | Published-only projection; ops deferred (brackets/live/billing) |
| `organizers` (P9 pending) | `/organizers`, `/organizers/[slug]`, `/workspace/organizer/**` | `features/organizers/*` | PROPOSED `organizers/organizer_members` + `search_organizers/get_organizer_by_slug` | Registry + membership; verification deferred |
| `organizations` (P8 proposed) | `/organizations`, `/organizations/[slug]` | `features/organizations/*` | PROPOSED only (no migration yet) | Discovery reader only; ownership internals never exposed |
| `brands` (P8 proposed) | `/brands`, `/brands/[slug]` | `features/brands/*` | PROPOSED only (no migration yet) | Intent-only filters; `representative_verified` frozen false |
| `news` (P4 proposed) | `/news`, `/news/[slug]`, `/workspace/articles/**` | `features/news/*` | PROPOSED only (no migration yet) | `NEWS_WRITES_ENABLED=false`; sanitize plain-text only |
| `moderation` (P10/P11 pending) | `/workspace/moderation/**` | `features/moderation/{domain,schemas,server}` | PROPOSED `moderation_reports/verification_cases/moderation_decisions` | Shell disabled; no queue reads, no review actions |
| `tools` (P5/P6/P7 static) | `/tools`, `/tools/[slug]` (3 runners) | `features/tools/{catalog,prize-pool,roster,tiebreak}` | NONE (intentionally local-only) | No DB assumption; e2e `tools/*` cover runners |

Route ownership rule: `src/app/<vertical>/{page,_lib/query,_components/*}` may only call
its feature's `server/*-reader` + shared `lib/`; never another feature's internals.

## 3. Dependency boundaries

```
app → lib/server/features (orchestration)
features/<slug>/server → lib/supabase (injected SupabaseClient)
server/repositories → lib/supabase (DB access, one file per table/domain)
server/services → repositories (pure business logic)
components/* → leaves (no DB, no Supabase import)
```

Enforced today (verified `grep`):
- `domain/` has no I/O; `schemas/` is Zod single-source; `server/` is sole Supabase/RPC boundary.
- No cross-tool internal imports (`features/sponsor-sentinel → features/prize-splitter` pattern absent;
  `teams/services/search` only references legacy comments, not code).
- `src/server/supabase-admin.ts` is server-only (`typeof window` guard) and never imported
  by `components/` or `app/**/page.tsx` client paths — only integration tests + future webhooks/cron.
- Violation to fix (non-blocking, pre-launch): `src/types/database.ts` is a placeholder
  (`Record<string,never>`); regenerate via `npm run db:types` after link (`05` §test).

## 4. Shared infrastructure rules

- **Supabase clients**: browser `lib/supabase/client.ts` (anon, `"use client"` forms only);
  server `lib/supabase/server.ts` (`createServerClient` + `cookies()`); admin `server/supabase-admin.ts`
  (service_role, `persistSession:false`, never browser). Middleware `lib/supabase/middleware.ts` refresh only.
- **Auth**: `getUser()` (not `getSession()`) for guards; `ensure_app_user()` lazy 1:1 bootstrap.
- **Validation**: Zod at every route/feature boundary (`schemas/`), `exactOptionalPropertyTypes`, no `any`.
- **Env**: `lib/env.ts` (public) + `server/env.ts` (server, service_role) Zod-validated;
  only `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY/APP_URL` + `SUPABASE_SERVICE_ROLE_KEY` (see `.env.example`).
  No `NEXT_PUBLIC_` service_role; no secrets committed (`.env` gitignored, `.env.example` placeholders).
- **AuthZ**: explicit `requireUser`/`requireOrganizationContext`-style gates at page/action top;
  RLS default-deny + masked RPCs for public reads; triggers enforce immutability/trust/materiality.
- **Errors/logging**: generic domain errors to UI (`*OperationError`), never raw PostgREST detail;
  404-equivalence (missing/private/suspended → identical 404); `unavailable-state` for RPC outage.
  No PII in logs; `admin/audit.ts` redacts (`findForbiddenAuditKey` test).
- **Tests/fixtures**: unit lane `npm test` (99 files/1012 tests, fake clients, no DB);
  integration lane `*.integration.test.ts` (requires linked project, excluded by default);
  e2e `playwright` (chromium, `PLAYWRIGHT_BASE_URL` or local `npm run dev`).
- **Assets**: no binary ownership yet; avatars/entity-media via storage buckets with
  foldername-`auth.uid()` policies (see `04` §12).

## 5. Architecture vs legacy-isolation

Current architecture **does not violate** isolation (see `03`):
- No runtime import into `ref/`; `tsconfig.exclude: ref/**`; `eslint.ignores: ref/**`;
  `next.config.ts`, `vercel.json`, `package.json` scripts, `vitest` include, `playwright` `testDir`
  all legacy-free.
- Only gap is naming: `ref/legacy-project/` should become top-level `legacy/` per objective B.
  Proposed mapping in `01 §7`; no code move required (pure directory rename + ignore-pattern update).

No broad rewrite recommended. Next steps are DB-first (see `05`, `06`), not structural.
