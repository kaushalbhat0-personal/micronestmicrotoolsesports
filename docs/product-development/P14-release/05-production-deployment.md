# 05 — Vercel production deployment (P14-A, 2026-11-12)

Dashboard: https://vercel.com/kaushal-bhats-projects/micronestmicrotoolsesports
Project: `micronestmicrotoolsesports` (`prj_qIXcAEb9pL2Cnf2HCJesyVndAJ4Y`,
Next.js, Node 24.x). Method: Vercel MCP (read-only) + public-URL fetch.
No env values read or printed (`decrypted: false` throughout).

## 1. Git connection

- Repo: `kaushalbhat0-personal/micronestmicrotoolsesports` (matches local).
- Production branch: `main` — proven by deployment meta
  (`githubCommitRef: main`, `target: production`, `source: git`).
- Auto-deploy ON: our Phase-3 push triggered a production deployment
  within the same window. No branch-config change needed or made.

## 2. Deployment record

| Deployment | Commit | State | Target |
| ---------- | ------ | ----- | ------ |
| `dpl_5UeBSkrwv1dtJyiRkZkoEi21Ru5A` (2026-11-12, post-push) | `01893ae` new platform | ERROR | production |
| `dpl_Ex2rwpQjZgn3jg9XefiH7Rz9A9n4` | `bdece4d` legacy | READY (`isRollbackCandidate: true`) | production |
| older | legacy line | READY | production |

Project `live: false`; latestDeployment = the ERROR build.

## 3. Failure cause (release-blocking, in the release commit itself)

`dpl_5UeBS…`: `errorMessage: "The vercel.json schema validation failed
with the following message: should NOT have additional property comment"`.
Build never started (fails at config validation, zero build cost beyond
the attempt). Root cause at `vercel.json:3` (tracked, identical at
01893ae and worktree):

```json
{ "$schema": "https://openapi.vercel.sh/vercel.json",
  "comment": "Greenfield: no cron jobs yet. …" }
```

`comment` is not a valid `vercel.json` property. Fix = delete line 3
(one-line config fix, no behavior change). Requires a NEW commit on `main`
(fast-forward `01893ae → fix`, no force) — NOT performed; awaiting separate
approval (§5 below) because it deploys a different commit than the verified
release SHA and RCCF discourages release-easing commits.

## 4. Environment variables (names only)

Present for production: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_APP_NAME`
(+ legacy billing/streaming keys: DODO×2, RAZORPAY×3, KICK×2, YOUTUBE×2,
TWITCH×2, `CREDENTIALS_ENCRYPTION_KEY`). All 4 names from `.env.example`
are configured. Values never read.

## 5. Current production state

- Live alias content = LEGACY platform (verified by fetch: toolbox
  marketing site — BGMI Lab, Tournament Hub, paid tools). The failed
  deployment did NOT replace production traffic.
- New platform is NOT live anywhere. No new-platform deployment exists.

## 6. Exact remediation proposal (NOT executed)

1. Edit `vercel.json`: remove the `comment` line (keep `$schema`).
2. `git add vercel.json && git commit -m "fix(release): drop invalid vercel.json comment blocking Vercel schema validation"` (on `new-platform`, staging ONLY that file; 68 WIP entries stay uncommitted).
3. `npm run build` re-verify (config-only change; full battery already green).
4. `git push origin new-platform:main` (fast-forward expected; on rejection: stop, report).
5. Verify new production deployment READY + commit SHA, then run §06 smoke.
