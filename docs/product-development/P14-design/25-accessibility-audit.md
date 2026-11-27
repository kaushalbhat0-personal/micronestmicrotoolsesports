# 25 — Accessibility Audit (P14-B3 Phase 3)

Environment: Playwright Chromium (repo `playwright.config.ts`, `@playwright/test
1.65.0`) against dev `http://localhost:3001` (audit harness) and production
`next start http://localhost:3003` (visual confirmation); Lighthouse 13.6.0
via npx cache against production. axe-core is not in the toolchain
(`package.json` has no axe dependency), so the audit used the existing
Playwright setup plus computed-contrast checks and Lighthouse — per the brief,
no full WCAG 2.2 AA conformance is claimed.

## Results

| Area | Check | Result |
|---|---|---|
| Landmarks | header, `main#main-content`, footer, nav `Primary`/`Mobile`/`Footer` | Present at 320/375/768/1024/1440 |
| Headings | single `h1` (“Where esports talent gets discovered”); `h2` order discovery → tournaments → editorial → tools → closing | 1 h1, 5 h2, logical order (Lighthouse `heading-order` 1.0) |
| Link purpose | all 62 homepage links named, no `href="#"`, no dead slugs | 0 unnamed, 0 placeholders (Lighthouse `link-name` 1.0) |
| Button names | Menu/Close disclosure + CTAs (links) | 0 unnamed (Lighthouse `button-name` 1.0) |
| Images | homepage ships zero `<img>` | No alt-text risk (`image-alt` n/a); Stitch photography intentionally not reproduced |
| Mobile nav | Menu toggles `aria-expanded`, panel `hidden`-toggled, 11 links + CTA, closes cleanly | Verified 320/375/768/1024 |
| Touch targets | all interactive ≥44px height (sr-only skip link excluded by design) | 0 violations at all widths (Lighthouse `target-size` 1.0) |
| Keyboard | Tab order: skip link → brand home → Primary links; skip link receives focus | Logical, visible on focus |
| Focus | `focus-visible` 2px offset rings on all CTA variants (white ring on arena, accent/ink on light) | Present in code, visible in screenshots |
| Reduced motion | `prefers-reduced-motion` guard kills animation/transition; marketing ships zero animation | `globals.css:100`, no `animate-*`/`transition-*` in marketing (grep-verified) |
| Contrast (computed, live DOM) | hero h1 19.34, hero body 13.03, eyebrow-on-dark 8.59, accent CTA 5.88, dark CTA 5.88, eyebrow-on-light 5.88, ink body 7.58, pathway links 5.88, status note 9.45, footer body 13.03, footer secondary 7.36, footer links 15.7, dossier 6.9, chips 12.21 | All ≥ 4.5 AA (Lighthouse `color-contrast` 1.0) |
| Lighthouse a11y | production mobile run | 1.0 overall; `list`/`listitem`/`definition-list`, `document-title`, `html-has-lang`, `landmark-one-main`, `aria-allowed-attr`, `skip-link` all pass |

## Defects fixed in B3

None outstanding — the audit confirmed zero homepage defects. (B2 had fixed
tablet overflow via the `xl:` header breakpoint and tool-card touch targets;
re-verified here: overflow 0px at all widths.)

## Limitations (not claims)

- Automated checks only; no screen-reader pass performed.
- axe-core absent from toolchain — noted, not installed (avoids new deps).
- Lighthouse desktop preset failed with `NO_FCP` in this headless Windows
  background session; mobile run is the reported result.
- “PASS” in doc 28 scopes to this automated + manual-check evidence, not a
  general WCAG conformance certification.
