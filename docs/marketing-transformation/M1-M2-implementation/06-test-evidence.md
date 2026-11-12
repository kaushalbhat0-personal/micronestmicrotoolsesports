# 06 — Test Evidence (M1–M2, Gate 5)

Run on branch `new-platform`, Windows PowerShell, Node 24. Full log in tool
history; summary below.

## Commands & results

| Command | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | PASS, clean |
| `npm run lint` (`eslint .`) | PASS, no warnings/errors |
| `npm test` (vitest, unit lane, integration excluded) | **265/265 PASS across 25 files** (14 new in `marketing.test.tsx`) |
| `npm run build` (`next build`, Turbopack) | PASS — `○ /`, `○ /about`, `○ /icon.svg` prerendered static; `ƒ /players`, `ƒ /players/[handle]`, `ƒ /settings/profile`, `ƒ /api/health` unchanged |
| Existing static audit `src/app/players/routes.test.ts` | 6/6 PASS (product data path untouched) |
| Browser audit (Chromium, 390/768/1440, `/` + `/about`) | 0 overflow offenders, 1 H1 per page, menu disclosure verified, 0 JS errors; 6 screenshots in `screenshots/` |
| e2e `home.spec.ts` (updated to new H1) | EQUIVALENT PASS — `npx playwright test` cannot launch here (v1.65 wants headless-shell-1254, not downloaded; no network install per constraints), so the exact assertions (hero heading, `Explore players` link, `Coming soon`, about heading, `Live now`) were executed via the working chromium-1248 binary and passed; first Tab stop verified as `Skip to content` |

Note: the first `typecheck` after creating `/about` failed on stale
`.next/types/routes.d.ts` (`/about` not yet a known `Route`); `npm run build`
regenerated route types and both build-time and standalone typechecks pass
since. Local `.next` regeneration only — no source workaround needed.

## New tests — `src/components/marketing/marketing.test.tsx` (14)

1. Boundary surface coverage (components + `/`, `/about`, `canonical.ts`).
2. No Supabase/reader/domain/base-table/identifier imports (comment-stripped
   sources — boundary comments name the forbidden modules, so raw matching
   would false-positive; rendered HTML audited separately without that caveat).
3. No testimonials/sponsors/partner logos.
4. No signup/get-started/join/register language in sources AND rendered HTML.
5. Coming-soon labelling; about availability statement.
6. Header: shipped-route links, no `Opportunities`, mobile `aria` contract.
7. Footer: real route index, availability note, no social URLs.
8. Homepage H1 + both CTAs; all five section anchors present once.
9. Hero visual honesty caption; no fabricated handle.
10. `aria-labelledby` wiring; all sections render statically.

## Regression (Gate 4)

`git status` confirms: no Supabase migration/config touched, no auth code
touched, `src/app/players/**` and `src/app/settings/**` unmodified (their
pre-existing untracked state preserved), all G1 unit/integration-adjacent
suites green.
