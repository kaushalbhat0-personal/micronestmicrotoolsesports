# 07 — Legacy Removal Readiness (P14-C1, updated P14-C3)

Status: **Evidence-backed checklist.** Rename EXECUTED in P14-C3 (`ref/legacy-project/` → `legacy/`,
1299 files, blob-SHA-verified; see `10-legacy-consolidation-execution.md`).
No deletion executed. `git rm -r legacy/` is **safe subject to the checklist below** —
not yet executed because deletion itself remains separately authorized.

## Checklist (verified P14-C1; rename + re-verification P14-C3)

| # | Gate | Evidence | Verdict |
|---|---|---|---|
| 1 | No new-platform runtime import of legacy | 19 `legacy/` hits all comment-only post-rename; `from`+`legacy` co-occurrences are `PORT/REIMPLEMENT` comments, zero runtime imports | PASS |
| 2 | No TS alias into legacy | `tsconfig paths: @/* → ./src/*` only; `exclude: legacy/**` (updated P14-C3); `tsc` pass with `ref/` absent | PASS |
| 3 | No Next.js dep on legacy | `next.config.ts` headers/typedRoutes only; `middleware` matcher static-only; `build` pass with `ref/` absent | PASS |
| 4 | No package script dep | All 11 scripts legacy-free; `db:types` local-schema only | PASS |
| 5 | No build/deploy dep | `vercel.json` schema-only; `config.toml` greenfield; legacy crons isolated at `legacy/application/vercel.json` | PASS |
| 6 | No test dep on legacy runtime | `vitest include: src/**`, `playwright testDir: ./e2e`; 99 files / 1012 pass with `ref/` absent | PASS |
| 7 | No active migration refs legacy schema | Active 20 files contain zero legacy DDL; legacy 58 files at `legacy/database/migrations/`, never copied | PASS |
| 8 | Docs don’t require legacy for runtime | New-platform docs instruct greenfield flows; legacy docs are reference + extraction registers | PASS (live pointers fixed P14-C3: `README.md`, `docs/README.md`, `.github/workflows/README.md`; 31 historical `ref/legacy*` hits in `docs/` retained as evidence) |
| 9 | Required assets outside legacy | `public/.gitkeep` only; avatars via storage buckets, not legacy `public/` (isolated at `legacy/application/public/`) | PASS |
| 10 | Remaining refs documented/classified | `10 §6–§7`: 19 comment-only provenance notes updated `ref/legacy-project/` → `legacy/` (16 src files); no code refs | PASS |

## Blockers (must clear before `git rm -r legacy/`)

1. **Rename DONE (P14-C3)**: `ref/legacy-project/` → `legacy/` per 01 §7 mapping (1299 files,
   blob-SHA-verified). `tsconfig.exclude`, `eslint.ignores` (`ref/**` → `legacy/**`), 19 src
   comment pointers, `README.md`, `docs/README.md`, `.github/workflows/README.md`, and
   `legacy/README.md` layout updated. Staged as 1299 `R` renames; commit pending authorization.
2. **Worktree dirty by design**: 17 unstaged mods (10 pre-existing + 7 authorized pointer updates)
   + 740 untracked files preserved verbatim (no stash/clean). Deletion on a dirty tree
   risks confusion; require `git status` review + owner go-ahead.
3. **Stale doc pointers FIXED (P14-C3)**: `docs/README.md`, `.github/workflows/README.md`,
   `README.md` now point at `legacy/`. Remaining 31 `ref/legacy*` hits in `docs/` are
   historical evidence records, intentionally retained.
4. **No empty dirs**: `legacy/assets/` NOT created; only materialized dirs
   (`application/`, `database/`, `configuration/`, `tooling/`, `documentation/`) + `README.md`.

## Post-rename verification (before any deletion) — DONE P14-C3

- `ref/legacy` in `src/supabase/e2e/scripts`: 0 code refs (19 `legacy/` hits comment-only);
  `docs/` retains 31 historical `ref/legacy*` evidence hits by design.
- `tsc`, `eslint`, `vitest` (99/1012), `next build` all PASS with `ref/` absent.
- History-preserving `git mv` used; `git status` shows renames (`R`), not adds+deletes.

Deletion itself (`git rm -r legacy/`) remains a **future separately authorized** operation.
This report does NOT authorize it.
