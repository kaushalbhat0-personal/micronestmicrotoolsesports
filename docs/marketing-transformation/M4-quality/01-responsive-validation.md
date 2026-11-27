# 01 — Responsive Validation (Gate 1)

Method: real Chromium (Playwright 1.65, headless-shell 1254) against the
production build (`next start`, port 3101). Viewports 360 / 390 / 430 / 768 /
1280 / 1440 × routes `/` + `/about` = 12 captures in `screenshots/`
(`home-{w}.png`, `about-{w}.png`). Per-config DOM audit: `scrollWidth` vs
`clientWidth`, wide-element offenders, H1 count, landmarks, nav/menu
visibility, CTA bounding heights, page errors. Script: `m4-sweep.cjs` (session
temp dir, outside the repo).

## Results — all 12 pass

| Route | 360 | 390 | 430 | 768 | 1280 | 1440 |
|---|---|---|---|---|---|---|
| `/` overflow (`scrollW − clientW`) | 0 | 0 | 0 | 0 | 0 | 0 |
| `/about` overflow | 0 | 0 | 0 | 0 | 0 | 0 |
| Wide-element offenders | 0 | 0 | 0 | 0 | 0 | 0 |
| H1 count | 1 | 1 | 1 | 1 | 1 | 1 |
| JS page errors | 0 | 0 | 0 | 0 | 0 | 0 |

Landmarks every config: `header 1, main 1, footer 1` (home H2 6, about H2 5).
Nav switching: disclosure `Menu` button < 768px, desktop `Primary` nav ≥
768px — correct at all six widths, both routes.

## Composition review (screenshot pass, by me)

- **Hero**: H1 clamps to 2.5rem at 360 (verified readable in `home-360.png`);
  CTAs stack full-width ≤ 430, sit side-by-side ≥ 768; proof panel drops below
  copy on single-column layouts. No clipped text, no overlaps.
- **CTAs**: every visible CTA bounding height = 44px at every width (hidden
  mobile-panel links report 0 — `hidden` attribute, expected).
- **Sections**: ecosystem rail 1→2→4 columns, discovery split stacks, pathway
  rows collapse label-first, BGMI giant type scales via `clamp()`, roadmap
  1→2→3 columns, footer 1→2 columns. Spacing rhythm (`py-14 / sm:py-20`)
  consistent; section transitions (arena/paper/steel) hold at all widths.
- **Header/footer**: sticky header never covers anchors (no same-page anchor
  nav in header); footer stacks cleanly at 360.

## Screenshot index

`screenshots/home-{360,390,430,768,1280,1440}.png`,
`screenshots/about-{360,390,430,768,1280,1440}.png` (final build),
plus `home-390-header-fixed.png`, `home-390-menu-fixed-open.png`,
`home-1280-header-fixed.png` (header verification, §Gate 4 support).
