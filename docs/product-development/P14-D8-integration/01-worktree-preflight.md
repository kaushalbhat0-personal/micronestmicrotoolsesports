# 01 — Worktree Preflight (P14-D8)

## Branch / remote

| Check | Result |
| --- | --- |
| Current branch | `new-platform` |
| HEAD (pre-commit) | `376df8f651f3142dcaacb2ddbcbf269b38196040` |
| Remote | `origin` → `https://github.com/kaushalbhat0-personal/micronestmicrotoolsesports.git` |
| Remote heads | `origin/new-platform` and `origin/main` both at `376df8f` |
| Local upstream | Not configured for `new-platform` (will set on push `-u`) |
| Recent log | `376df8f` fix(release) vercel.json; `01893ae` foundation; archive commits |

## Worktree shape (pre-stage)

| Category | Count / note |
| --- | --- |
| Staged legacy renames | **1299** (`ref/legacy-project/**` → `legacy/**`) |
| Non-legacy staged | 0 |
| Unstaged modified | 18 tracked files (app shell, package.json, docs README, etc.) |
| Untracked | ~822 (src platform, supabase migrations, docs, e2e, `.cursor`, `AGENTS.md`, `.vercelignore`) |

## Constraints honored

- No branch switch
- No force push / reset / stash / clean
- No push to `main` / `master`
- No production deploy or promotion
- LMS not accessed
