# 10 — Legacy Consolidation Execution (P14-C3)

Status: **Executed and verified** (2026-11-12). No commit, no push, no deploy, no DB mutation, no legacy deletion.

## 1. Git preflight (Stage 1)

- Branch: `new-platform` (`git branch --show-current`).
- HEAD: `376df8f651f3142dcaacb2ddbcbf269b38196040` (unchanged; `git log --oneline -3` = `376df8f`, `01893ae`, `b68957f`).
- Pre-move worktree (captured before any move):
  - Tracked modified (unstaged): **10 files** — `.gitignore`, `e2e/home.spec.ts`, `package.json`,
    `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`,
    `src/components/shared/site-footer.tsx`, `src/components/shared/site-header.tsx`,
    `src/config/site.ts`, `src/types/database.ts` (9 from P14-C1 baseline + `database.ts` from P14-C2).
  - Untracked files: **740 files** (`git ls-files --others --exclude-standard | Measure`;
    P14-C1 baseline 731 + 8 C1 docs + 1 C2 doc = 740; no unexpected work).
  - Staged: 0. Stash: empty.
- Ignored files within legacy: **0** (`git ls-files --others --ignored --exclude-standard -- ref/` empty;
  `git check-ignore` confirms `node_modules` pattern would apply if present, but no such file exists on disk).
- Files inside `ref/legacy-project/`: **1299 files / 11,916,759 bytes (11.36 MB)** on disk;
  **1299 tracked** (`git ls-files -- ref/`), **0 untracked** (`--others -- ref/` empty),
  **0 modified** (`git status --short -- ref/` empty).
- Symlinks: **0** (`Get-ChildItem -Attributes ReparsePoint` under `ref/`).
- File counts and sizes per top dir (disk): `application/` 1226, `supabase/` 60,
  `toolchain/` 11, `deployment/` 1, `README.md` 1.
- Destination `legacy/` pre-move: absent (`Test-Path legacy` = False) — no overwrite risk.
- Comparison against P14-C1 baseline (§1: 9 modified + 731 untracked):
  delta is exactly +1 tracked mod (`src/types/database.ts`, P14-C2 authorized regen)
  and +9 untracked (8 C1 isolation docs + 1 C2 execution doc). No foreign work introduced.
- Modified/untracked inside legacy directory itself: **none**. All 10 modified and 740 untracked
  live outside `ref/legacy-project/`. Moving the directory therefore cannot overwrite or lose
  existing work. Preflight verdict: **SAFE to move** (proceed per Stage 3; do not stash/commit).

Preservation rule observed throughout: no `stash`, `reset`, `clean`, `checkout`, `restore`,
`commit`, or `push`. The only index writes are the authorized `git mv` renames (staged)
plus Stage 4 pointer updates (unstaged).

## 2. Complete legacy inventory (Stage 2)

Actual tree inspected (matches P14-C1 §5):

- `ref/legacy-project/README.md` (1593 B): archive rules, layout description.
- `ref/legacy-project/application/` (1226 files): old Next app — `src/`, `public/` (logos/video),
  `docs/` (screenshots), `demos/`, `middleware.ts`, `vercel.json` (legacy crons),
  `.github/bgmi-tournaments-ingest.yml` + `meta-parser-ingest.yml`, `ARCHITECTURE.md`, `README.md`.
- `ref/legacy-project/supabase/` (60 files): legacy `config.toml`, 58 migrations
  (`20250930000001_initial_schema.sql` … `20251122000001_*`), `seed.sql`.
- `ref/legacy-project/toolchain/` (11 files): `.env.example` (4293 B), `.prettierignore`,
  `.prettierrc`, `eslint.config.mjs`, `next-env.d.ts`, `next.config.ts` (1149 B),
  `postcss.config.mjs`, `tsconfig.json`, `package.json` (2355 B), `package-lock.json` (331421 B),
  `vitest.config.ts`. All placeholders; no secrets.
- `ref/legacy-project/deployment/` (1 file): pointer `README.md` only, no active config.

No empty directories created. No flattening. Nested structure preserved verbatim.

## 3. Source/destination mapping (executed)

| Source (pre-move) | Destination (post-move) | Files | Notes |
|---|---|---|---|
| `ref/legacy-project/application/` | `legacy/application/` | 1226 | Whole-directory `git mv`; history preserved as renames |
| `ref/legacy-project/supabase/` | `legacy/database/` | 60 | Rename clarifies DB reference (`config.toml`, 58 migrations, `seed.sql`) |
| `ref/legacy-project/toolchain/` → configs | `legacy/configuration/` | 8 | `.env.example`, `.prettierignore`, `.prettierrc`, `eslint.config.mjs`, `next-env.d.ts`, `next.config.ts`, `postcss.config.mjs`, `tsconfig.json` |
| `ref/legacy-project/toolchain/` → package/test | `legacy/tooling/` | 3 | `package.json`, `package-lock.json`, `vitest.config.ts` |
| `ref/legacy-project/deployment/` | `legacy/documentation/` | 1 | Directory rename; `README.md` preserved as `legacy/documentation/README.md` |
| `ref/legacy-project/README.md` | `legacy/README.md` | 1 | Content updated for new layout (see §5) |
| `ref/` (empty shell) | removed | 0 | `ref/legacy-project/toolchain` (empty) → `ref/legacy-project` (empty) → `ref/` (empty) removed via filesystem rmdir after verification; no tracked files deleted |

Total: **1299 files moved, 0 omitted**. `legacy/assets/` intentionally NOT created (empty-dir rule).

## 4. Move execution (Stage 3)

Sequence (all history-preserving):

1. Captured pre-move manifest: `git ls-files -s -- ref/legacy-project/` → 1299 lines;
   disk CSV 1299 files; size 11,916,759 bytes.
2. `New-Item legacy/` then `git mv ref/legacy-project/application legacy/application` (exit 0;
   `git status` shows `R` renames).
3. `git mv ref/legacy-project/supabase legacy/database` (exit 0).
4. `New-Item legacy/configuration,legacy/tooling`; per-file `git mv` of 8 configs + 3 tool files
   (all exit 0; `toolchain/` empty afterwards).
5. `git mv ref/legacy-project/deployment legacy/documentation` (exit 0).
6. `git mv ref/legacy-project/README.md legacy/README.md` (exit 0).
7. Verified counts/hashes (§5), then removed empty shells
   (`ref/legacy-project/toolchain`, `ref/legacy-project`, `ref/`) — filesystem only, no `git rm`.
8. New platform untouched except authorized Stage 4 pointer edits; active `supabase/migrations/`
   (20 files) never touched; no legacy migration copied into it.

Post-move state: `git ls-files -- legacy/` = 1299, `git ls-files -- ref/` = 0,
`Get-ChildItem -Recurse legacy` = 1299 files (1226 + 60 + 8 + 3 + 1 + 1 README),
size 11,916,759 bytes (byte-identical to pre-move).

## 5. Hash/count verification

- Tracked: pre `ref/` 1299 → post `legacy/` 1299, `ref/` 0. No file silently omitted.
- Blob-SHA comparison: sorted blob hashes from pre-move manifest vs
  `git ls-files -s -- legacy/` — **identical sets (1299/1299)**. `Compare-Object` empty.
  Verdict: **HASH VERIFICATION PASS — all 1299 blob SHAs preserved**.
- Disk: pre 1299 files / 11,916,759 B → post 1299 files / 11,916,759 B. Exact match.
- Worktree preservation: 10 pre-existing modified still present (now 17 with 7 authorized
  Stage 4 edits, see §6); 740 untracked preserved (`(git ls-files --others).Count` = 740
  before and after); staged = 1299 renames only; stash empty; HEAD unchanged.

Files NOT moved and why: none — every file under `ref/legacy-project/` was relocated
per the mapping. Empty shell dirs were removed (not archived). Historical docs under
`docs/architecture/legacy-isolation/01–09` were intentionally left in place (evidence record,
not legacy source). No legacy migration was brought into `supabase/migrations/`.

## 6. Updated references (Stage 4)

Only old-path pointers updated; no runtime import from `legacy/` introduced:

- `tsconfig.json`: `exclude: ["node_modules", "ref/**"]` → `["node_modules", "legacy/**"]`.
- `eslint.config.mjs`: `ignores` `"ref/**"` → `"legacy/**"`
  (other `legacy` word hit is pre-existing `@rushstack/eslint-patch` comment, untouched).
- `README.md` §Structure: `` `ref/legacy-project/` `` → `` `legacy/` ``.
- `docs/README.md`: stale `ref/legacy-platform/docs/`, `ARCHITECTURE.md`, `README.md`
  → `legacy/application/docs/`, `legacy/application/ARCHITECTURE.md`, `legacy/README.md`.
- `.github/workflows/README.md`: `ref/legacy-platform/.github/workflows/*.yml` (×2)
  → `legacy/application/.github/workflows/*.yml` (×2).
- `src/` provenance comments (19 hits, all comment-only): `ref/legacy-project/` → `legacy/`
  in 16 files — `features/news/domain/sanitize.ts` (1), `features/teams/domain/{levels,matching,roles}.ts`
  (3), `features/teams/roster/{conflicts,normalize,output,parser,schemas,slots}.ts` (6),
  `features/teams/schemas/team.ts` (1), `features/teams/services/search.ts` (2),
  `features/teams/README.md` (1), `features/README.md` (1), `lib/game-catalog/catalog.ts` (1),
  `server/admin/audit.ts` (3). Verified `ref/legacy` hits in `src/` = 0 post-update.
- `legacy/README.md`: layout section rewritten for new names —
  `supabase/` → `database/`, `toolchain/` split into `configuration/` (8 configs) + `tooling/`
  (package/lock/vitest), `deployment/` → `documentation/`. `application/vercel.json` pointer unchanged.
- `legacy/documentation/README.md`: `../application/...` pointers still valid (sibling layout
  preserved) — no change.
- Inspected with no change (already legacy-free): `package.json` scripts (11 scripts, none
  reference `ref/`/`legacy/`), `next.config.ts` (headers/typedRoutes only), `vercel.json`
  (schema-only), `vitest.config.ts` (`include: src/**`), `playwright.config.ts`
  (`testDir: ./e2e`), `scripts/` (empty), CI (no workflow references `ref/` beyond the README fixed above).
- Historical docs (`01–09`, audits, product-discovery registers, P14-release notes) intentionally
  NOT rewritten (31 remaining `ref/legacy*` hits in `docs/` are evidence records of the pre-move
  state; see §8.10).

New-platform runtime code never imports from `legacy/` (see §7.1).

## 7. Complete isolation verification (Stage 5)

1. **Runtime import scan** — `Select-String legacy/` in `src/*.ts/*.tsx/*.md`: 19 hits, all
   provenance comments (`Legacy: …`, `Legacy reference: …`, `` `legacy/` `` rule). `from`+`legacy`
   co-occurrence (12 lines) all `// PORT/REIMPLEMENT from legacy …` comments — zero
   `from "legacy/"` / `import("legacy/")` runtime imports. **PASS**.
2. **TypeScript alias scan** — `paths: @/* → ./src/*` only; no `@/legacy`, `legacy/*` alias;
   `exclude: legacy/**`; `tsc --noEmit` PASS with `ref/` absent. **PASS**.
3. **ESLint scan** — `ignores` includes `legacy/**`, `.next`, `node_modules`, `coverage`,
   `playwright-report`, `test-results`; `eslint .` PASS (exit 0). **PASS**.
4. **Next.js scan** — `next.config.ts` typedRoutes + lucide optimize + security headers only;
   no `webpack.alias`/`transpilePackages`/rewrites into `legacy/`; middleware matcher static-only. **PASS**.
5. **Package scripts scan** — 11 scripts legacy-free; `db:types` targets local schema only. **PASS**.
6. **Vercel/deploy scan** — root `vercel.json` schema-only; legacy crons isolated at
   `legacy/application/vercel.json` + `legacy/application/.github/*.yml`, never referenced by root;
   `supabase/config.toml` greenfield (`project_id="micronest-esports"`); legacy `config.toml` at
   `legacy/database/config.toml`. **PASS**.
7. **Test config scan** — `vitest include: src/**`, `playwright testDir: ./e2e`; 99/1012 pass
   with `ref/` absent; no test imports `legacy/`. **PASS**.
8. **Supabase migration scan** — active `supabase/migrations/` 20 files contain zero legacy DDL;
   legacy 58 live only at `legacy/database/migrations/`; `grep` brands/organizations/articles in
   active chain: only greenfield comments. **PASS**.
9. **Asset scan** — `public/` = `.gitkeep` only; legacy images/video isolated at
   `legacy/application/public/` + `legacy/application/docs/*.png`; avatars served from storage
   buckets, not legacy `public/`. **PASS**.
10. **Documentation pointer scan** — live pointers updated (§6); remaining `ref/legacy*` hits
    (31 files under `docs/`) are historical evidence/audit registers, explicitly classified
    do-not-rewrite; `src/` `ref/legacy` = 0. **PASS with note**.

Deletion readiness: `git rm -r legacy/` remains the single-operation removal (not executed).
`ref/` is gone, so the command is now literally `git rm -r legacy/`.

## 8. Validation (Stage 6)

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | PASS (exit 0, post-move + pointer updates) |
| `npm run lint` (`eslint .`) | PASS (exit 0) |
| `npm test` (unit, excl. integration) | PASS — 99 files / 1012 tests |
| `npm run build` (Turbopack) | PASS — 36 routes listed, middleware proxy, static/dynamic mix |
| Import-boundary checks | PASS — 0 runtime `legacy/` imports (§7.1) |
| Legacy dependency scans | PASS — 10/10 gates (§7) |
| E2E | Not run (requires dev server/browser; unit + build cover isolation gates) |
| Integration `*.integration.test.ts` | Not run (requires linked DB writes; excluded by `npm test` default) |

No destructive DB operations. No `apply_migration`, `execute_sql` writes, `db reset/push/pull/repair`,
storage deletion, or sibling-project access. No Supabase schema/migration-history modification.
No deploy.

## 9. Final root directory structure

```
MicroNest MicroTools - Esports/
  .agents/  .git/  .github/  .next/  .vercel/
  docs/  e2e/  legacy/  node_modules/  playwright-report/  public/ (.gitkeep)  scripts/ (empty)
  src/  supabase/  test-results/
  AGENTS.md  README.md  package.json  tsconfig.json  next.config.ts  eslint.config.mjs
  vitest.config.ts  playwright.config.ts  postcss.config.mjs  vercel.json  next-env.d.ts
  .prettierrc  .prettierignore  .env  .env.example  .gitignore
  legacy/
    README.md
    application/    (1226 files — old Next app, docs, demos, public, .github, vercel.json)
    database/       (60 files — legacy config.toml, 58 migrations, seed.sql)
    configuration/  (8 files — next/ts/postcss/eslint/prettier/next-env/env-example)
    tooling/        (3 files — package.json, package-lock.json, vitest.config.ts)
    documentation/  (1 file — deployment pointer README.md)
```

`ref/` absent. No `legacy/assets/` (rule). No flattening. `supabase/migrations/` (20 greenfield files)
contains zero legacy content.

## 10. Remaining blockers

1. **Staged-but-uncommitted rename**: 1299 `R` renames are staged (index) alongside 17 unstaged
   modifications and 740 untracked files. No commit/push executed per constraints. A future
   authorized commit will show pure renames (verify `git status` shows `R`, not `A`+`D`).
2. **Worktree still dirty by design**: 17 unstaged mods (10 pre-existing + 7 authorized pointer
   updates) + 16 untracked-src comment edits + 740 untracked files preserved verbatim. No stash/clean
   performed. Owner review before commit recommended.
3. **Historical doc pointers**: 31 `docs/**/*.md` files still cite `ref/legacy-project/` as evidence
   of the pre-move state (`01–09`, audits, discovery registers). Intentionally unrewritten; the new
   execution record is this file. Update only if a docs-refresh phase is authorized.
4. **Deletion not authorized**: `git rm -r legacy/` verified as the single-operation removal but
   NOT executed (future separately-authorized phase + owner go-ahead required).

No technical blocker to building, testing, or committing. New platform builds and tests
independently with `ref/` absent.
