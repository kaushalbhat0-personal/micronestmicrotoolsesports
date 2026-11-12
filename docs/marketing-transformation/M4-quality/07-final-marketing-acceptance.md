# 07 — Final Marketing Acceptance (Gates 1–7)

## Gate results

| # | Gate | Evidence | Verdict |
|---|---|---|---|
| 1 | Six widths validated | `01`: 12/12 zero-overflow, 15 screenshots | PASS |
| 2 | WCAG 2.2 AA, no critical issues | `02`: axe 0 violations (F1/F2 fixed), LH a11y 100 ×4 | PASS |
| 3 | Perf measured, regressions addressed | `03`: 0.9/100/100/100 profile, 187 KiB, SI disposition | PASS |
| 4 | Real Playwright execution | `04`: `npx playwright test` 2/2, versions recorded | PASS |
| 5 | Metadata/canonicals/indexing | `05`: heads verified, sitemap added, noindex preserved | PASS |
| 6 | Import boundaries | `npm test` 265/265 incl. `marketing.test.tsx` (14) + `routes.test.ts` (6) | PASS |
| 7 | No product regressions | typecheck/lint/build green; players/settings/auth/Supabase untouched | PASS |

## Product-accuracy reconfirm (M4 re-read of sources + renders)

No metrics, users, sponsors, testimonials or logos; Coming-soon/Planned labels
intact on every unshipped domain; no signup/registration language in sources
or rendered HTML (test-enforced); all nav hrefs resolve to shipped routes;
hero visual still captioned illustrative. `git status` confirms Supabase,
migrations, auth, product routes and `package.json` unmodified (only
pre-existing states remain).

## Limitations (explicit)

1. Speed Index lab values (11–27s) are a localhost-simulation artifact —
   dispositioned in `03`, not a product defect; needs origin field data.
2. No screen-reader walkthrough (tooling unavailable); mitigated by axe
   `wcag22aa` clean + keyboard walkthrough + native semantics.
3. INP has no lab value (static pages, no interaction script); TBT ≤ 100ms
   is the proxy until field data exists.
4. OG/social previews ship without images (honest; no raster fabricated).

## Remaining work (non-blocking, ordered)

1. Post-deploy: confirm field LCP/INP + social-card rendering on the real
   origin; add origin sitemap ping if the host needs it.
2. Optional licensed condensed face (see `06`).
3. G1-8B unlocks (unchanged): signup vocabulary, session-aware header.

## Final verdict

**PASS** — the marketing frontend meets the documented launch-quality gates.
Two genuine issues were found and fixed, one bad experiment was caught by its
own verification and reverted, and every measurement above is reproducible
with the commands recorded in `01`–`05`.
