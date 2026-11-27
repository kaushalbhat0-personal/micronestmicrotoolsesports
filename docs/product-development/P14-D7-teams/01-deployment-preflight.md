# 01 — Deployment Preflight (P14-D7)

## Git / worktree (preserved)

| Check | Result |
| --- | --- |
| Branch | `new-platform` |
| HEAD | `376df8f651f3142dcaacb2ddbcbf269b38196040` |
| Tracking | local only (no upstream ahead/behind shown) |
| Staged legacy archive renames | **1299** (`R` `ref/legacy-project/**` → `legacy/**`) — **not** staged/unstaged by this phase |
| Non-legacy staged | **0** |
| Unstaged modified | ~18 tracked files |
| Untracked | ~810 (includes full Teams app under `src/features/teams`, `src/app/teams`, etc.) |
| LMS access | Never |
| Destructive git ops | None (no reset/stash/clean/commit/push) |

**Critical:** Teams write activation and UI are **not in HEAD**. Safe preview path = Vercel CLI filesystem deploy of the dirty worktree (not git-linked SHA alone).

## Vercel linkage

| Field | Value |
| --- | --- |
| Project | `micronestmicrotoolsesports` |
| Project ID | `prj_qIXcAEb9pL2Cnf2HCJesyVndAJ4Y` |
| Team | `team_5sXYYqiUCdvjfuzfdRK11yiS` |
| Framework | Next.js / Node `24.x` |
| Config | `.vercel/project.json` present; `vercel.json` schema-only |
| SSO protection | enabled (`all_except_custom_domains`) — preview needs share bypass |

## Production (unchanged)

| Field | Value |
| --- | --- |
| Production URL | `https://micronestmicrotoolsesports.vercel.app` |
| Production deployment | `dpl_GFNDFjQCwPQmZcJDoJhoAQN2odwx` |
| Production SHA | `376df8f` (`main`) |
| State | READY |
| This phase | **No promote / no prod env mutation** |

## Supabase

| Check | Result |
| --- | --- |
| Linked ref | `knniommcyyhbyiwljisk` |
| Local `.env` host | `knniommcyyhbyiwljisk.supabase.co` |
| LMS ref | Absent from local Supabase URL values |
| Migration ledger | **24** local = remote (through `20261115000001`) |

## Write switches

| Switch | Value |
| --- | --- |
| `WORKSPACE_WRITES_ENABLED` | **true** |
| `ORGANIZER_WRITES_ENABLED` | false |
| `TOURNAMENT_WRITES_ENABLED` | false |
| `MODERATION_WRITES_ENABLED` | false |
| `NEWS_WRITES_ENABLED` | false |

## Env audit (names only; values never printed)

Preview targets include: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_APP_NAME`.

- No `NEXT_PUBLIC_*SERVICE_ROLE*` / public DB secrets in source.
- `SUPABASE_SERVICE_ROLE_KEY` is preview+production server env only.
- CLI `vercel env pull` returns empty for Sensitive vars; build-time injection still supplies them (prior READY production proves store is populated).
- Many OAuth/payment keys are production-only; Teams cookie auth uses Supabase only.

## Deploy hygiene added

`.vercelignore` added for preview upload lean-ness (excludes `legacy/`, `ref/`, `.env*`, media, etc.). Not committed.
