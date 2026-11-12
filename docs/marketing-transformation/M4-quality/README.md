# M4 — Marketing Quality, Accessibility & Launch Polish

Branch: `new-platform`. M4 is a quality pass over the accepted M1–M2
implementation — no redesign, no new product domains, no new dependencies
(`package.json` untouched), no Supabase/auth changes, no commits.

## What M4 did

- **Fixed 2 genuine issues**: axe `color-contrast` serious finding on ghost
  numerals (new `--color-ghost` token, 3.42:1) and a missing explicit
  focus-visible ring on the skip link.
- **Prototyped and rejected** a no-JS `<details>` header: structurally invalid
  (summary must be a direct child; closed details hides brand/nav) — caught by
  screenshot review, reverted to the verified button header. Full story in `03`.
- **Added `src/app/sitemap.ts`** (`/` + `/about` only) — resolves the M0/M1
  open question affirmatively (see `05`).
- **Measured everything**: 12-viewport browser sweep, axe 4.14.0 WCAG 2.2 AA
  on 4 configs, Lighthouse 13.6.0 ×4 on production, real `npx playwright test`
  run, production `<head>` audit.

## Files

1. `01-responsive-validation.md` — Gate 1.
2. `02-accessibility-audit.md` — Gate 2.
3. `03-performance-audit.md` — Gate 3.
4. `04-browser-test-evidence.md` — Gate 4.
5. `05-seo-metadata-audit.md` — Gate 5.
6. `06-brand-consistency-review.md` — polish record.
7. `07-final-marketing-acceptance.md` — Gates 1–7 + verdict.

Machine artifacts: `screenshots/` (15 genuine captures), `reports/`
(4 Lighthouse JSON reports).

## Gate verdicts

| Gate | Verdict |
|---|---|
| 1 — All six widths validated (`/`, `/about`) | PASS |
| 2 — No unresolved critical a11y issues; WCAG 2.2 AA reviewed | PASS (axe 0 violations; LH a11y 100 ×4) |
| 3 — Performance measured, no major regressions | PASS (0.9/100/100/100-profile; SI anomaly documented, not product) |
| 4 — Actual Playwright execution | PASS (`npx playwright test` 2/2) |
| 5 — Metadata, canonicals, indexing | PASS (sitemap added; noindex preserved) |
| 6 — Import boundaries preserved | PASS (265/265 incl. boundary audits) |
| 7 — No product regressions | PASS |

**Final verdict: PASS** — details and explicit limitations in `07`.
