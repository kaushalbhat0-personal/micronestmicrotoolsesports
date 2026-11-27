# 01 — Repository Inventory (P14-C1)

Status: **Implemented and verified** (read-only scans, 2026-11-12).
No commits, no pushes, no DB mutations, no legacy modifications.

## 1. Git and worktree preflight

- Branch: `new-platform` (`git branch --show-current`).
- HEAD: `376df8f fix(release): drop invalid vercel.json comment` (plus `01893ae`, `b68957f`, `8692390`, `dc5aee0` greenfield history).
- Modified (tracked, preserved, NOT touched):
  - `.gitignore`, `e2e/home.spec.ts`, `package.json`, `src/app/globals.css`,
    `src/app/layout.tsx`, `src/app/page.tsx`,
    `src/components/shared/site-footer.tsx`, `src/components/shared/site-header.tsx`,
    `src/config/site.ts` (9 files, `git diff --stat HEAD`).
- Untracked: 731 files (`git ls-files --others --exclude-standard | Measure`).
  Bulk = in-progress new-platform work: `AGENTS.md`, `docs/architecture/g1-*`,
  `docs/audits/*`, `docs/marketing-transformation/*`, `docs/product-development/P1-P14/*`,
  `docs/product-discovery/*`, `e2e/players.spec.ts`, `e2e/tools/*`,
  `src/app/{about,brands,news,organizations,organizers,players,settings/profile,teams,tools,tournaments,workspace/*}`,
  `src/components/marketing/*`, `src/features/*`, `src/lib/game-catalog/*`,
  `src/server/admin/*`, `supabase/migrations/20261110*-20261113*` (11 local-only migrations).
- Stash: empty. No commit/push/deploy executed in this phase (see `08-execution-summary.md`).
- Preservation rule applied: no `git checkout --`, no `git reset`, no file overwrites
  outside `docs/architecture/legacy-isolation/`.

## 2. Root listing

```
.git/, .github/, .next/, .vercel/, .agents/, docs/, e2e/, node_modules/,
playwright-report/, public/ (.gitkeep only), ref/legacy-project/,
scripts/ (empty), src/, supabase/, test-results/
AGENTS.md (untracked), README.md, package.json, tsconfig.json,
next.config.ts, eslint.config.mjs, vitest.config.ts, playwright.config.ts,
postcss.config.mjs, vercel.json, next-env.d.ts, .env, .env.example, .gitignore
```

- `supabase/.temp/`: `linked-project.json` → `knniommcyyhbyiwljisk`,
  `project-ref` → `knniommcyyhbyiwljisk`, local CLI state only.
- `scripts/`: empty (0 entries) — no tooling dependency.
- `public/`: `.gitkeep` only — no binary assets to migrate; marketing sections are
  code-only (`src/components/marketing/*`).
- `docs/`: `architecture/g1-identity-player-profile/`, `audits/`, `marketing-transformation/`,
  `product-development/P1-P14*/`, `product-discovery/A0-D1.6.1/` + `README.md`.
  `docs/README.md` references stale `ref/legacy-platform/` path (actual `ref/legacy-project/`) —
  doc-only, no runtime effect.

## 3. New-platform source (`src/`)

Authoritative inventory via subagent sweep + `glob`/`grep` (see `02`, `03`):

- `src/app/`: 35+ routes. Shell (`layout/error/not-found/sitemap/icon`),
  `/`, `/about`, `/api/health`, `/players[/[handle]]`, `/teams[/[slug],/new]`,
  `/tournaments[/[slug]]`, `/tools[/[slug]]`, `/news[/[slug]]`,
  `/brands[/[slug]]`, `/organizations[/[slug]]`, `/organizers[/[slug]]`,
  `/settings/profile`, `/workspace/{teams,organizer,tournaments,articles,moderation}`.
  All pages thin orchestration; workspace writes gated with `*_DISABLED_MESSAGE`.
- `src/features/`: 9 domains — `player-profile` (largest, G1 live),
  `teams`, `tournaments`, `organizations`, `organizers`, `brands`, `news`,
  `moderation`, `tools` (static catalog `prize-pool/roster/tiebreak`, no DB).
  Pattern `domain/` (pure) + `schemas/` (Zod) + `server/` (Supabase/RPC) + `tests/`.
- `src/lib/`: `cn.ts`, `env.ts` (public), `canonical.ts`, `game-catalog/catalog.ts`,
  `supabase/{server,client,middleware}.ts`, `example.ts`.
- `src/server/`: `env.ts` (server, includes `SUPABASE_SERVICE_ROLE_KEY` zod),
  `supabase-admin.ts` (`createAdminClient`, server-only guard), `admin/audit.ts`.
- `src/components/`: `ui/button.tsx`, `shared/{site-header,site-footer,container}.tsx`,
  `marketing/*` (12 static sections + test).
- `src/config/site.ts`, `src/types/{index,database}.ts` (placeholder `Database`
  with `Record<string,never>`, `npm run db:types` pending link), `src/middleware.ts`
  (delegates to `updateSession`, matcher excludes static assets).

## 4. Supabase active backend (`supabase/`)

- `config.toml`: `project_id="micronest-esports"`, PG17, ports 54321/54322/54320/54323/54324/54327,
  seed `./seed.sql`, auth site `http://localhost:3000`, storage 50MiB, realtime/edge/Deno2/pgdelta on.
- `seed.sql`: intentionally empty greenfield seed (3 lines).
- `migrations/`: 20 local files, 159,292 bytes:
  - G1 applied-track: `20261110000001_foundation_baseline`,
    `...02_storage_foundation`, `...03_g1_identity_anchor`,
    `...04_g1_identity_anchor_grant_tightening`, `...05_g1_player_profile`,
    `...06_g1_game_catalogue`, `...07_g1_public_projection`,
    `20261111000008_g1_owner_settings_lifecycle`, `...09_g1_handle_function_fix`.
  - Local-only proposals (NOT on remote, see §6): `20261112000001_d1_admin_foundation`,
    `...02_d1_teams_discovery`, `...03_d1_security_remediation`,
    `...04_d1_insert_boundary_indexes`, `...05_p9_organizer_foundation`,
    `...06_p9_tournament_link`, `20261113000001_p11_f01_trust_guard`,
    `...02_p11_f02_published_integrity`, `...03_p11_moderation_queue`,
    `...04_p13_f02_snapshot`, `...05_p13_activation`.
- Remote ledger (`supabase list_migrations`, project `knniommcyyhbyiwljisk`):
  9 applied (`20261110000001` … `20261111091947_handle_function_ambiguity_fix`).
  Timestamps differ from local filenames (dashboard-applied stamps) but name roots match
  the 9 G1 files. The 11 D1/P9/P11/P13 files are absent remotely — verified destruction-safe.
- Remote schema (`list_tables verbose` + `execute_sql` SELECT-only):
  4 tables (`app_users 0 rows`, `player_profiles 0`, `games 1 row bgmi`, `player_game_profiles 0`),
  7 functions, 12 policies, 10 indexes, 3 triggers, 3 buckets (`public-avatars`,
  `public-entity-media`, `private-verification`), 8 storage policies, 0 `auth.users`,
  0 `storage.objects`, 0 views, 0 cron jobs, extensions `pgcrypto/plpgsql/uuid-ossp/pg_stat_statements/supabase_vault`.
  Full matrix in `04-new-platform-database-requirements.md`.

## 5. Legacy reference (`ref/legacy-project/`)

- `README.md` (1593 B): complete pre-greenfield preserve, reference-only, no imports, no secrets.
- Layout: `application/` (1226 files / 279 dirs — old Next app, `src/`, `public/`, `docs/`, `demos/`,
  `middleware.ts`, `vercel.json` with legacy crons, `.github/bgmi-tournaments-ingest.yml`),
  `supabase/` (60 files — legacy `config.toml` + 58 migrations e.g. `20250930000001_initial_schema.sql` + `seed.sql`),
  `toolchain/` (11 files — legacy `package.json/lock`, `next/ts/postcss/eslint/vitest/prettier`, `.env.example` placeholders),
  `deployment/README.md` (reserved, no active config).
- Symlinks: none (`Get-ChildItem -Attributes ReparsePoint` → 0).
- Duplicates: intentional cross-archive basenames (`config.toml`, `seed.sql`, `next.config.ts`,
  `package.json`, etc.) + intentional greenfield patterns (`not-found.tsx×7`, `query.test.ts×7`, …).
  No filesystem collisions; no flattening performed.

## 6. Classification

| Path | Class | Rationale |
|---|---|---|
| `src/**`, `e2e/**` (new), `supabase/{config.toml,seed.sql,migrations/20261110*-20261113*}` | **1. New platform — retain outside legacy** | Greenfield runtime + fresh migration lineage; `tsconfig.exclude: ref/**`, `eslint.ignores: ref/**` prove separation |
| `ref/legacy-project/**` | **2. Legacy-only — move into legacy archive** | Historical reference; never imported at runtime (only comment provenance, see `03`) |
| `docs/**` (root + `ref/legacy-project/application/docs/`) | **3. Shared/reference — inspect explicitly** | New-platform docs stay outside; legacy docs stay inside archive; stale `docs/README.md` path is doc-only |
| `.next/`, `node_modules/`, `test-results/`, `playwright-report/`, `supabase/.temp/` | **4. Generated/temporary — preserve with justification** | Build/test/CLI state; gitignored except `tsbuildinfo`; never archived |
| Untracked `AGENTS.md`, in-progress `docs/product-*` drafts, modified `src/*` worktree files | **5. Unclear until owner review — do NOT move** | User work in progress; preserved verbatim |

No path required reclassification during this phase. No file assumed legacy by directory alone.

## 7. Source-to-destination move mapping (PROPOSED, not executed)

No filesystem move executed (worktree preservation + 1299-file risk; see `07`, `08`).
Proposed atomic mapping for a future authorized operation:

| Source (current) | Destination (target `legacy/`) | Notes |
|---|---|---|
| `ref/legacy-project/application/` | `legacy/application/` | Whole-directory move; preserves history |
| `ref/legacy-project/supabase/` | `legacy/database/` | Rename clarifies DB reference; update `ref/legacy-project/README.md` pointer |
| `ref/legacy-project/toolchain/` | `legacy/configuration/` + `legacy/tooling/` | Split: configs → `configuration/`, package/vitest → `tooling/`; or keep `legacy/toolchain/` if rename risk unwanted |
| `ref/legacy-project/deployment/` | `legacy/documentation/` (merge) | Only `README.md`; do not create empty `legacy/assets/` |
| `ref/legacy-project/README.md` | `legacy/README.md` | Update paths `application/→application/`, `supabase/→database/` |
| `ref/` (empty shell after) | remove | Only after verification |

Do NOT create `legacy/assets/` empty. Do NOT flatten structures.
Pre-move checks (blocking): duplicate-basename audit done (§5), symlink audit done (0),
`git status` clean-or-stashed, `tsconfig`/`eslint` ignore update `ref/**` → `legacy/**`,
docs pointer sweep (`src/features/README.md`, `src/features/teams/README.md`,
`src/lib/game-catalog/catalog.ts` comments reference `ref/legacy-project/` — comment-only but update to `legacy/`).
