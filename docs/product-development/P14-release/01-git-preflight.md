# 01 — Git preflight (P14-A, read-only, 2026-11-12)

Method: `git branch`, `rev-parse`, `status`, `log`, `ls-tree`, `show`,
`merge-base`, `rev-list`, `fetch --prune --tags`. No checkout, no commit,
no push, no stash, no clean. `gh` CLI unavailable — GitHub branch
protection could not be queried; the push result in Phase 3 is the test
(do not bypass on rejection).

## 1. Current branch and HEAD (reconfirmed)

- Branch: `new-platform`. HEAD: `01893ae5b0275979649edb754e4dd9ea6cbaebb7`
  (`chore(supabase): establish clean backend foundation`). Matches the
  P13-B known HEAD — unchanged.

## 2. Working-tree status (dirty, preserved)

- Staged: 0 files (`git diff --cached` empty).
- Unstaged modifications (10 tracked files): `.gitignore`, `e2e/home.spec.ts`,
  `next-env.d.ts`, `package.json`, `src/app/globals.css`, `src/app/layout.tsx`,
  `src/app/page.tsx`, `src/components/shared/site-footer.tsx`,
  `src/components/shared/site-header.tsx`, `src/config/site.ts`.
- Untracked (58 paths): greenfield platform work — `AGENTS.md`, `docs/`
  (architecture, audits, marketing-transformation, product-development,
  product-discovery), `e2e/tools/`, ~20 new `src/app` routes, 6 new
  `src/components|features|lib|server` trees, 18 `supabase/migrations`
  files (G1 03–09 through P13 04–05). Total status entries: 68.
- Safest way to continue: NEVER switch branches, stash, or clean. All
  Phase 2–3 operations use explicit refspecs (`new-platform:main`) that do
  not touch the worktree. No commit is made to ease the release (RCCF).

## 3. Local branches and HEADs

- `main` → `caff7a2` (`chore: checkpoint legacy platform before greenfield
  rebuild`), tracking `origin/main` with 1 commit ahead.
- `new-platform` → `01893ae` (checked out).

## 4. Remote branches and HEADs (after `fetch --prune --tags`)

- `origin/main` → `bdece4d` (`feat(bgmi-lab): ship Loot Dash arcade game`).
- `origin/master` → `b6ffe27` (unrelated line, left alone).
- `origin/new-platform`: does NOT exist. `origin/legacy-archive`: does NOT
  exist.

## 5. `origin/main` vs `origin/new-platform`

- `origin/main` = `bdece4d` (legacy). `origin/new-platform` = absent
  (to be created in Phase 3 as rollback/reference).

## 6. Merge-base and ancestry

- `merge-base(main, new-platform)` = `caff7a2` (local main HEAD — fully
  contained in new-platform).
- `rev-list origin/main..new-platform` = 5 commits
  (`caff7a2, dc5aee0, 8692390, b68957f, 01893ae`), 0 behind.
- `origin/main` is a strict ancestor of `new-platform` → a plain
  fast-forward push `new-platform:main` is permitted by ancestry. No
  force-push is needed or planned. If the server rejects it (protection),
  stop — do not bypass.

## 7. Tags and relevant history

- One tag: `platform-release-2026-10-16` → `e5f3f2b` (legacy line,
  `ad5341a feat(platform): release toolbox…`). Not moved, not used.
- Legacy line (`origin/main` history): `bdece4d ← 4ad27ff ← 11aa1d0 ← …`
  (bgmi-lab games, tournament hub, billing).
- Greenfield line (new, atop `caff7a2`): `dc5aee0` (archive legacy, prepare
  workspace) → `8692390` (approve product + backend) → `b68957f` (archive
  + init greenfield app) → `01893ae` (clean backend foundation).
- No stash entries.

## 8. Branch protection

- Not accessible from this environment (no `gh`, no authenticated API).
  Recorded as UNKNOWN. Phase 3 treats a server rejection as authoritative:
  report it, do not bypass, do not force-push without separate approval.

## 9. Content confirmation

- `main`/`origin/main` = legacy code: root tree has `ARCHITECTURE.md`,
  `demos/`, `middleware.ts`, full legacy `src/`; NO `ref/` directory.
- `new-platform` = intended new platform: minimal greenfield root
  (`src/app` = api/error/globals/layout/not-found/page at HEAD 01893ae),
  `ref/legacy-project/` present (reference-only archive), `supabase/`
  foundation (2 committed migrations), clean `package.json` scripts
  (`test`, `typecheck`, `lint`, `build`; no `test:e2e` at HEAD — added by
  uncommitted work), `.env.example` documents variable NAMES only
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- Critical release note: at HEAD 01893ae the deployable commit contains the
  greenfield skeleton + Supabase foundation only. All routes, features, and
  G1→P13 migrations exist as UNCOMMITTED work and will NOT be part of
  `origin/main` after promotion (per RCCF they are not committed to ease the
  release). The smoke test must assess what is actually deployed.
