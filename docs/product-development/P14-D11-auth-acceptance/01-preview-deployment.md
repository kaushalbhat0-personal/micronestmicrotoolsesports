# 01 — Preview Deployment (P14-D11)

Inspected and redeployed on **2026-11-27**. Production was not promoted.

## Source state (uncommitted — preserved, not committed)

- Branch: `new-platform`, HEAD `3b7ad5b` (`docs(p14-d8): note docs follow-up SHA in execution summary`).
- Worktree: repo root (single attached worktree).
- P14-D10 implementation remains **uncommitted** and was the exact source uploaded:
  - Modified: `src/app/login/{login-form,page}.tsx`,
    `src/app/workspace/teams/_components/workspace-states.tsx`,
    `src/components/marketing/{arena-hero,closing-cta,marketing.test}.tsx`,
    `src/components/shared/{site-header,site-footer}.tsx`, `next-env.d.ts` (generated).
  - Untracked: `src/app/auth/`, `src/app/signup/`, `src/app/forgot-password/`,
    `src/components/shared/site-header-shell.tsx`, `src/components/shared/site-header.test.tsx`,
    `src/lib/auth/`, `docs/product-development/P14-D10-auth-onboarding/`.
- No commit, push, or production promotion was performed.

## Deployment (this run)

| Field | Value |
|---|---|
| Preview URL | `https://micronestmicrotoolsesports-56tuaj8c4-kaushal-bhats-projects.vercel.app` |
| Deployment ID | `dpl_8LpooTHvFwGpprafnkdpkFT9PT3w` |
| Inspector | `https://vercel.com/kaushal-bhats-projects/micronestmicrotoolsesports/8LpooTHvFwGpprafnkdpkFT9PT3w` |
| Target | **Preview** (`target: null` / Environment Preview) |
| Status | Ready |
| Method | `npx vercel deploy --yes` (CLI file upload of working tree, including untracked P14-D10 files) |
| Build | Next.js 16.4.6 Turbopack; `Build Completed in /vercel/output [13s]` |
| Source identity | HEAD `3b7ad5b` + uncommitted P14-D10 set above |

Built routes include `/signup`, `/login`, `/forgot-password`, `/auth/callback`, `/workspace/teams`.

## Environment target

- Vercel project: `micronestmicrotoolsesports` (`prj_qIXcAEb9pL2Cnf2HCJesyVndAJ4Y`, team `kaushal-bhats-projects`).
- Supabase vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`) are scoped
  **Production + Preview**. Preview therefore uses Esports project `knniommcyyhbyiwljisk`
  (confirmed by live cookie `sb-knniommcyyhbyiwljisk-auth-token` on preview origin).
- `NEXT_PUBLIC_APP_URL` is **Production-only**. Client auth flows use `window.location.origin`
  (signup `emailRedirectTo`, recovery `redirectTo`) — correct for preview.
- No LMS project refs in the P14-D10 change set. Linked ref file / local URL host =
  `knniommcyyhbyiwljisk` only.

## Production rollback baseline (unchanged)

- Latest production remains
  `https://micronestmicrotoolsesports-9g8v8lq2x-kaushal-bhats-projects.vercel.app`
  (`dpl_GafkVrfXxgsWPausP8jZp7bNsXye`, Ready, Environment Production).
- No production deploy or promote was created during this task.

## Deployment protection (preview only)

- Anonymous fetch → 302 to Vercel SSO.
- Temporary test access only (both revoked in cleanup — see 07):
  - Shareable `_vercel_share` link (created via MCP; value withheld; revoked).
  - Project automation bypass secret used as `x-vercel-protection-bypass` (value withheld; revoked).
- Pre-existing env-var automation bypass left untouched.
- No production protection or env changed.

## Feature write switches (unchanged)

- `WORKSPACE_WRITES_ENABLED = true`
- `TOURNAMENT_WRITES_ENABLED = false`
- `ORGANIZER_WRITES_ENABLED = false`
- `NEWS_WRITES_ENABLED = false`
- `MODERATION_WRITES_ENABLED = false`
