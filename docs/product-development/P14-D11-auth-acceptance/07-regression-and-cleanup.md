# 07 — Regression and Cleanup (P14-D11)

## Regression

| Check | Result |
|---|---|
| Typecheck (`tsc --noEmit`) | PASS |
| Lint (`eslint .`) | PASS (0 errors; warnings only from temporary probe scripts, since removed) |
| Production build (`next build`) | PASS — routes include `/signup`, `/auth/callback`, `/forgot-password`, `/workspace/teams` |
| Unit (`vitest run` excl. integration) | PASS — 103 files / **1018** tests |
| Local E2E (home/players against localhost) | **8/9** PASS. One failure: `home.spec.ts` expects hero CTA `Explore players`; P14-D10 intentionally uses `Sign up free` (unit contract updated). Stale E2E expectation — not fixed here. |
| Full local E2E first pass | Invalid: `PLAYWRIGHT_BASE_URL` was still pointing at protected preview; discarded. Corrected re-run above. |
| G1 integration lanes (live Esports, self-cleaning) | g1-1: 9✓; g1-2: 16✓; g1-3: 21✓; g1-4: 13✓; g1-7: 15✓. **g1-5 avatar: 9✓ + 1✗** — `removes the avatar without leaving a stale public URL` (`expected null not to be null`). Pre-existing storage consistency issue; no avatar/storage files in P14-D10/D11 change set. |
| Preview UI acceptance | PASS (browser suite, see 03–06) |
| Auth cookie-session | PASS — `sb-knniommcyyhbyiwljisk-auth-token` on preview after signup |
| Write switches | Unchanged: Workspace true; Tournament/Organizer/News/Moderation false |
| DB / RLS / grants / migrations | None — no `supabase/` changes; no DDL |
| Production | Unchanged — `…-9g8v8lq2x…` remains latest Production Ready deploy |

## Cleanup (verified)

- Disposable `p14d11-*` auth users: deleted during/after probes → **0 remaining**.
- G1 lanes self-clean tracked users/objects; no extra residue expected.
- Vercel automation bypass created for this run: **revoked** (only pre-existing env-var bypass remains).
- Shareable `_vercel_share` link: revoke requested.
- Temporary Playwright spec `e2e/p14d11-preview.spec.ts` and `tmp-p14d11/` probe scripts removed after evidence capture.
- Screenshots retained under this folder.
- Working tree preserved: P14-D10 modifications/untracked files intact; no commits/pushes.
- No secrets printed in docs (values withheld; cookie values never logged).
