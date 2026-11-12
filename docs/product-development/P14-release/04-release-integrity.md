# 04 — Release integrity (P14-A, 2026-11-12)

Scope note (honest): checks ran against the WORKTREE (release commit
01893ae + 68 preserved uncommitted changes). The deployed commit is the
skeleton; the worktree is its superset. Vercel's build (Phase 5) is the
true release-commit validation. No commit was made to ease the release.

## 1. Application root and scripts

- Root correct (`micronest-esports`, Next 16.4.6, React 19). Committed
  scripts: `test` (vitest, integration-excluded), `typecheck`, `lint`,
  `build`. Worktree adds `test:e2e` (Playwright) via uncommitted
  `package.json` change — used below, reported as worktree-only.

## 2. No legacy runtime imports

- `grep` for `from/require/import(…legacy…)` across `src/`: ZERO matches.
- 19 `legacy-project` mentions are all provenance COMMENTS
  (`// Legacy: ref/legacy-project/…`), never imports.
- `src/features/teams/README.md` explicitly pins: no imports from
  `ref/legacy-project/`. `ref/legacy-project/` remains reference-only.

## 3. Environment and secrets

- `.env.example` documents NAMES only (4 vars). No values in repo.
- `.env` and `.next/` are gitignored (`check-ignore` confirmed).
- Tracked env-like files: only `.env.example` files + legacy-ref helpers.
  No service-role key, token, or credential in any tracked file.

## 4. Write switches: all OFF

`ORGANIZER/TOURNAMENT/MODERATION_WRITES_ENABLED = false`
(+ `WORKSPACE-`, `NEWS-`), source + test-pinned. No migration flips them.

## 5. No migration or database changes

- CLI `migration list` re-verified: ledger IDENTICAL to P13-B (2 matched,
  7 remote-only G1, 14 local-only). No repair, push, reset, DDL, or DML.
- Historical migrations unmodified (18 untracked files preserved as-is).

## 6. No accidental artifacts

- `.next/`, `.env` ignored. `git status` shows only the 68 known
  work-in-progress entries — no credentials, dumps, or stray build output.

## 7. Routes present (production build output)

`/`, `/about`, `/players`, `/players/[handle]`, `/teams`, `/teams/[slug]`,
`/teams/new`, `/tournaments`, `/tournaments/[slug]`, `/news`, `/news/[slug]`,
`/organizations[/[slug]]`, `/brands[/[slug]]`, `/organizers[/[slug]]`,
`/tools`, `/tools/[slug]`, `/settings/profile`, workspace trees
(articles/moderation/organizer/teams), `/sitemap.xml`, `/icon.svg`.

## 8. Verification battery (worktree)

| Check | Result |
| ----- | ------ |
| `npm test` | 99 files / 1002 tests PASS |
| `npm run typecheck` | PASS (clean) |
| `npm run lint` | PASS (clean) |
| `npm run build` | PASS (all routes above) |
| `npm run test:e2e` | 23/23 PASS (chromium) |

Test configuration preserved (no config edits). Zero failures.
