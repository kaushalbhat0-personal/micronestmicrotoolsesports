# 07 — Asset Inventory

`public/` today: only `.gitkeep`. Only shipped graphic: `src/app/icon.svg` (28px M-mark + red baseline) + inline `BrandMark` duplicate. No photography, illustration, video, OG images, fonts. Nothing downloaded/generated in B1.

## Required assets (produce in B2, licensed/attributed)

| # | Location | Purpose | Size / ratio | Format | Source |
|---|---|---|---|---|---|
| A1 | `public/brand/wordmark.svg` | Header/footer lockup | SVG scalable (28px mark + text) | SVG | Original (from `icon.svg`) |
| A2 | `public/og/home-og.png` | Home share | 1200×630 | PNG | Original art (no fabrication) |
| A3 | `public/og/players-og.png` etc. | Pillar share (players/teams/tournaments/news/tools/about) | 1200×630 ×6 | PNG | Original |
| A4 | `public/images/bgmi-band.jpg` | BGMI editorial band | 21:9, ≤200KB | JPG/WebP | Licensed (credit) |
| A5 | `public/images/arena-proof.png` | Directory proof texture (optional) | 4:3 | PNG/SVG | CSS/SVG (prefer code) |
| A6 | `public/avatars/fallback.svg` | Avatar fallback | 1:1 96px | SVG | Original |
| A7 | `public/icons/` | Filter/sort/verified icons | 16–20px stroke set | SVG | Original (or Lucide already-installed — activate usage, no new dep) |
| A8 | `src/app/**/opengraph-image.tsx` | Dynamic OG per profile/detail | 1200×630 | Generated JSX | Code (no raster) |
| A9 | Fonts | Licensed condensed display + body | woff2 (latin) | woff2 | Procured (OFL/commercial) — replaces head of `font-display` stack; no `next/font` until licensed |

## Rules

- Attribution: record photographer/agency + license in `public/images/CREDITS.md`; surface caption/credit on editorial images (Hallmark photo rule).
- No Unsplash/Pexels via AI tools (terms); prefer Wikimedia Commons (CC0/PD/BY/SA) or direct license.
- Do not fabricate players/sponsors/results in imagery. Illustrative panels must stay labelled illustrative (existing `arena-hero` pattern).
- Prefer CSS/SVG over raster for bands, markers, radars, skeletons.
- `next/image` for photography only; keep avatar `unoptimized` until remote loader decided.
