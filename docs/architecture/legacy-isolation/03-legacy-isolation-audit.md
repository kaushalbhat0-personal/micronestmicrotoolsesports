# 03 — Legacy Isolation Audit (P14-C1)

Status: **Implemented and verified** (static scans + build/test evidence).
Verdict: **ISOLATED** — no runtime/config/test/deploy dependency on legacy.
One naming gap: `ref/legacy-project/` → `legacy/` rename still proposed (see `07`).

## 1. Import scan — PASS

- Tool: `grep` `from.*["']@/(ref|legacy)|ref/legacy|legacy-project|from.*\.\./.*legacy` in `src/`.
- Result: 19 hits, **all comment/provenance only**, zero runtime imports.
  Examples: `src/server/admin/audit.ts:3-5`, `src/lib/game-catalog/catalog.ts:2`,
  `src/features/teams/roster/*.ts:2`, `src/features/teams/README.md:25` (“No imports from `ref/legacy-project/`”).
- Subagent full-`src` sweep: “Zero runtime imports. All hits are comments/docs (provenance, explicitly no import).”
- `src/features/README.md:8` documents the rule: never import `ref/legacy-project/`.

## 2. TypeScript alias scan — PASS

- `tsconfig.json:25-29`: single alias `@/* → ./src/*`. No `@/legacy`, no `ref/*`, no `legacy/*`.
- `tsconfig.json:43-46`: `exclude: [node_modules, ref/**]` — legacy excluded from compilation.
- `vitest.config.ts:16-20`: alias `@ → ./src` only. `include: src/**/*.test.ts`, `exclude: node_modules/.next`.
- `tsc --noEmit` (this phase): **pass** with legacy present — proves no type dependency.

## 3. Next.js config scan — PASS

- `next.config.ts` (26 lines): `typedRoutes`, `optimizePackageImports: [lucide-react]`, security headers only.
  No `webpack.alias`, no `transpilePackages` pointing at legacy, no rewrites/redirects into `ref/`.
- `src/middleware.ts`: delegates to `updateSession`, matcher excludes `_next/static|image|favicon|*.svg|png|jpg|jpeg|gif|webp`. No legacy path.

## 4. Package script scan — PASS

- `package.json` scripts: `dev/build/start/lint/typecheck/test/test:all/test:integration/test:e2e/format/db:types`.
  None reference `ref/`, `legacy/`, `legacy-project`.
- `db:types`: `supabase gen types typescript --local --schema public > src/types/database.ts` — local schema only.
- Deps: Next 16.4.6, React 19.3.1, Supabase ssr 0.12.7 / js 2.119.0, Zod 4.6.7. No legacy package link.

## 5. Build / deployment scan — PASS

- `vercel.json`: `{ "$schema": "https://openapi.vercel.sh/vercel.json" }` only. No crons/rewrites.
  Legacy crons live at `ref/legacy-project/application/vercel.json` + `.github/bgmi-tournaments-ingest.yml` — not referenced by root.
- `supabase/config.toml`: `project_id="micronest-esports"`, PG17 — greenfield only; legacy `config.toml` stays at `ref/legacy-project/supabase/`.
- `npm run build` (this phase, Turbopack): **pass**, 16 static/dynamic routes listed, no `ref/` in trace.
- `.env.example` (11 lines): 4 keys only (`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY/APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`), placeholders. No legacy vars.

## 6. Test scan — PASS

- `vitest.config.ts`: `include: src/**/*.test.ts(x)` — `ref/**` never matched.
- `playwright.config.ts`: `testDir: ./e2e` — new-platform specs only (`home`, `players`, `tools/*`).
- `npm test` (this phase): **99 files / 1012 tests pass** with legacy present; no test imports `ref/`.
- Route-guard tests (`*/routes.test.ts`, `marketing.test.tsx:91`, `players/routes.test.ts:46`) assert
  `not.toContain(".from(")` — raw table access forbidden; RPC-only enforced by test, not legacy.

## 7. Supabase migration scan — PASS

- Active chain `supabase/migrations/` (20 files) contains **zero legacy migrations**.
  Legacy 58 migrations live at `ref/legacy-project/supabase/migrations/` (e.g. `20250930000001_initial_schema.sql`) — never copied.
- `grep` brands/organizations/articles in active migrations: only `storage_foundation` comment + `app_users` comment — no legacy DDL ported.
- Local-only proposals (D1/P9/P11/P13) are additive greenfield design, explicitly “LOCAL PROPOSAL NOT applied”
  in headers; they do not import legacy SQL.

## 8. Docs / asset scan — PASS with note

- New-platform docs (`docs/product-development/*`, `docs/architecture/g1-*`) do not instruct runtime use of legacy files.
  Legacy knowledge preserved at `ref/legacy-project/{application/docs,supabase}` + `docs/product-discovery/A0-A1` extraction registers.
- Note (non-blocking): `docs/README.md` references stale `ref/legacy-platform/` (actual `ref/legacy-project/`) — doc-only, fix with rename.
- Assets: `public/.gitkeep` only; no legacy image/font requires new-platform runtime. Avatar/entity-media
  served from storage buckets, not legacy `public/`.

## 9. Service-role / env boundary — PASS

- `grep service_role|supabase-admin|createAdminClient`: 8 hits — `server/supabase-admin.ts` (server-only guard),
  `server/env.ts` (zod), `server/admin/audit.ts:19` (string literal `"service_role"` in allowlist test),
  plus tests asserting `not.toContain("service_role")` (`moderation/security.test.ts:111`, `f01-trust-guard.test.ts:37`, etc.).
- No `service_role` import in `components/` or browser paths. `NEXT_PUBLIC_*` never carries service_role.

## 10. Remaining legacy references (all comment-only, classified)

| Reference | File | Disposition |
|---|---|---|
| `ref/legacy-project/application/src/server/admin/*` | `src/server/admin/audit.ts:3-5` | Keep as provenance comment; update to `legacy/` on rename |
| `ref/legacy-project/application/src/config/games/catalog` | `src/lib/game-catalog/catalog.ts:2` | Keep; update pointer on rename |
| `ref/legacy-project/application/src/features/meta-parser/` | `src/features/news/domain/sanitize.ts:2-4` | Keep; documents reimplementation, not port |
| `ref/legacy-project/.../finder/*`, `roster-builder/*`, `schemas/*` | `src/features/teams/**:1-4` (12 files) | Keep; explicitly “Legacy:” reimplementation notes |
| `ref/legacy-project/` rule | `src/features/README.md:8`, `src/features/teams/README.md:25` | Keep; update to `legacy/` on rename |

No runtime, type, config, script, test, or migration dependency. Rename is mechanical comment update.

## 11. Deletion-readiness (summary; full matrix in `07`)

All 10 checks pass except the rename itself (see `07` for evidence table).
`git rm -r legacy/` (after rename) is safe subject to pre-move checklist in `01 §7`.
No deletion executed in this phase per constraints.
