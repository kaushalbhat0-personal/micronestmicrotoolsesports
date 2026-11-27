# 06 — Production smoke test (P14-A, 2026-11-12)

Live deployment under test: `dpl_GFNDFjQCwPQmZcJDoJhoAQN2odwx`
(commit `376df8f`, state READY, target production). Method: HTTP GET via
fetch (read-only; zero mutations). No test account exists — no login,
registration, or authenticated call was attempted.

## A. Public routes (deployed skeleton = release commit + vercel.json fix)

| Route | HTTP | Outcome |
| ----- | ---- | ------- |
| `/` | 200 | New-platform homepage renders: discovery positioning, nav (Discovery/Opportunities), footer. Correct content for the deployed commit. |
| `/about` | 404 | Correct — route is uncommitted work, absent from 376df8f. Clean 404 (no 500). |
| `/players` | 404 | Correct — absent from deployed commit. |
| `/players/[valid-handle]` | not tested | No safe record exists (remote: 0 user rows; G1 seed is `bgmi` only). Inventing a handle to probe is out of scope. |
| `/teams` | 404 | Correct — absent from deployed commit. |
| `/tournaments` | 404 | Correct — absent from deployed commit. |
| `/news` | 404 | Correct — absent from deployed commit. |
| `/organizations` | 404 | Correct — absent from deployed commit. |
| `/brands` | 404 | Correct — absent from deployed commit. |
| `/organizers` | 404 | Correct — absent from deployed commit. |
| `/tools` | 404 | Correct — absent from deployed commit. |
| Tool sub-routes | not tested | Parent absent; nothing to probe. |

Pre-fix baseline (for the record): production served the legacy build
(`bdece4d`): `/`, `/tools`, `/login` = 200; `/about`, `/players`, `/teams`,
`/tournaments`, `/news`, `/brands`, `/organizers`, `/organizations`,
`/pricing`, `/bgmi-lab`, `/privacy-policy` = 404. `/login` rendered a
sign-in form — no credential was entered, no session created.

Rendering/console/network/mobile/a11y: homepage text shows no error
markers, no empty-state defects (skeleton has no data surfaces), navigation
labels present. LIMITATIONS (method): HTTP fetch cannot capture browser
console errors, failed sub-resource requests, mobile layout, or audited
a11y — none of these are claimed; they require a browser pass in a later
phase. No 500 observed on any probe.

## B. Authentication and account safety — BLOCKED

No authorized test account exists. Per RCCF no identity was fabricated, no
profile touched, no status changed, no token handled, no organizer/moderator/
admin identity created. Prerequisites to unblock: (1) owner-designated test
email(s), (2) explicit auth-testing authorization, (3) cleanup rule for any
test rows in `app_users`/`player_profiles`.

## C. Database-backed functionality

Remote Supabase = G1 baseline only (P13-B; re-verified ledger unchanged in
Phase 4). Classification against the DEPLOYED commit:

1. Verified against existing schema: NONE — the skeleton homepage is fully
   static (no Supabase call in the deployed tree's root page).
2. Frontend-only / intentionally unavailable: `/` (static); all 404s above
   (routes absent, not broken).
3. Blocked by unapplied migrations: every DB-backed feature (player/team/
   tournament/news/organization/brand/organizer surfaces, workspaces,
   moderation) — D1/P9/P11/P13 remain unapplied; their pages are also
   uncommitted. A successful local build is NOT claimed as DB proof.
4. Blocked by missing test identities: any authenticated or RLS-gated read.

## D. Security and stability

- No secrets in any fetched response (no keys/tokens/cookies observed in
  page text; env values never read anywhere in P14-A). LIMIT: client-bundle
  JS was not statically scanned — recorded as follow-up, not as a finding.
- No protected workspace reachable: workspace routes don't exist in the
  deployed commit (404, fail-closed by absence).
- Production mutations during testing: ZERO (GET-only; no form submitted).
- Unexpected 500s: none. Broken nav/assets: none observable via fetch
  (href-level asset audit needs a browser pass — recorded, not claimed).
- Mobile regressions: none observable via fetch — recorded as untested.
