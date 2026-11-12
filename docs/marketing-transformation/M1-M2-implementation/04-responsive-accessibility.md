# 04 — Responsive & Accessibility Evidence

## Method (real browser, not claimed)

Chromium (Playwright 1.65, executable `chromium-1248`) against `npm run dev`
on port 3100. Script: `m1m2-visual-audit.cjs` (kept outside the repo, in the
session temp dir). Five captures in `screenshots/`:

- `home-mobile-390.png`, `home-tablet-768.png`, `home-desktop-1440.png`
- `about-mobile-390.png`, `about-desktop-1440.png`
- `home-mobile-390-menu-open.png` (disclosure state)

## Results

| Check | 390px | 768px | 1440px |
|---|---|---|---|
| `scrollWidth === clientWidth` (no page-level horizontal overflow) | 390 = 390, 0 offenders | 768 = 768, 0 offenders | 1440 = 1440, 0 offenders |
| Single H1 | `Where esports talent gets discovered` | same | same |
| About single H1 | `About MicroNest Esports` | — | same |
| Mobile menu | `aria-expanded=true` after tap, `Discover players` visible, `Close` state captured | n/a (desktop nav) | n/a |
| JS errors on load | none | none | none |

## Accessibility foundations (built in, per M0 `06` rules)

- Landmarks: `header nav(main) footer`, one H1 per page, H2 per section via
  `aria-labelledby`, H3 for cards/rows.
- Skip link (existing, preserved); keyboard-native controls only
  (links + one disclosure `<button>`); visible `focus-visible` rings on every
  interactive element, white rings on arena backgrounds.
- Touch targets: CTAs, nav links, footer links, table action links all
  `min-height: 44px`; CTAs stack full-width on mobile.
- Decorative display numerals are `aria-hidden`; status is always text
  (`Live now` / `Coming soon` / `Planned`), never color-only; skeleton
  `role="status"` pattern on product pages untouched.
- `prefers-reduced-motion` guard in `globals.css`; no ambient animation ships.
- Contrast pairs computed and documented in `01` (accent-on-arena text banned
  at 3.29; `accent-bright` used instead at 8.59).

## Explicit limits (not claimed)

No axe run, no Lighthouse score, no screen-reader walkthrough in this phase —
recorded as M4 polish follow-ups. 360px and 430px widths were not captured
separately; 390px is the tightest tested width and the layouts are fluid
(`clamp()`, single-column collapse), so risk is low but unverified at 360px.
