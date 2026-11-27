# 02 — Legacy preservation (P14-A, 2026-11-12)

## Pre-check

- `legacy-archive` existed neither locally nor remotely (`branch -r` showed
  only `origin/main`, `origin/master`). Creation path taken, not overwrite.
- Actual legacy source = `origin/main` at `bdece4d` (live legacy history,
  NOT `ref/legacy-project/` alone — the in-repo archive is reference-only
  and, at HEAD, untracked worktree content; the commit history is the
  complete source).

## Operation (non-destructive, new ref only)

1. `git branch legacy-archive origin/main` — local ref at `bdece4d`.
2. `git push origin legacy-archive:legacy-archive` — new remote branch,
   no existing ref touched. Worktree never switched, stash never used.

## Verification (`git ls-remote origin`)

- `refs/heads/legacy-archive` = `bdece4db981a42719f74286ae6a9dbc15f68cd18`
- `refs/heads/main` (still legacy at this point) = `bdece4d…` — EXACT match.
- `refs/heads/master` untouched (`b6ffe27`).

## Status

Legacy history preserved 1:1 on `origin/legacy-archive` with original SHA
recorded above. No legacy file rewritten, no legacy branch deleted, no
legacy runtime code moved into the new platform. Rollback anchor exists
before any `main` update.
