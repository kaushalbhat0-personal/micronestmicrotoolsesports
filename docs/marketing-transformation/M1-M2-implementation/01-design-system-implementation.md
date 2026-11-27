# 01 — Design System Implementation (M1, Gate 1)

Implements the M0 `04-design-system-proposal.md` starting spec. Deviations are
flagged with rationale.

## Tokens — `src/app/globals.css` (`@theme`)

Tailwind v4 theme tokens, all marketing-scoped. No product token overwritten
(product surfaces keep the default slate scale — verified: no `--color-slate-*`
or `--font-sans` overrides exist in the file).

| Token group | Values |
|---|---|
| Arena (near-black) | `--color-arena-950 #0A0E14`, `-900 #111826`, `-800 #1C2534`, `--color-arena-line` (translucent white borders) |
| Editorial | `--color-paper #FFFFFF`, `--color-steel-100 #F1F5F9`, `--color-steel-200 #E2E8F0` |
| Ink | `--color-ink-900 #0F172A`, `--color-ink-600 #475569`, `--color-steel-ink #334155` |
| Accent (one red) | `--color-accent-600 #C8102E` (text/CTA on light), `--color-accent-700 #A50D26` (hover), `--color-accent-300 #FF8A96` (text on dark) |
| Display face | `--font-display`: system condensed stack (head: Oswald/Archivo Narrow/Arial Narrow → system-ui fallback) |

### Contrast (computed, WCAG AA)

| Pair | Ratio | Use |
|---|---|---|
| accent-600 on paper / white on accent-600 | 5.88 | body text, CTA ✓ |
| white on accent-700 | 7.82 | CTA hover ✓ |
| accent-300 on arena-950 | 8.59 | text/links on dark ✓ |
| accent-600 on arena-950 | 3.29 | DECORATIVE ONLY (keylines, dots) — never text |
| steel-ink on steel-100 | 9.45 | muted band text ✓ |
| ink-600 on paper | 7.58 | secondary text ✓ |

## Typography

- **Display**: condensed uppercase grotesk, 800 weight, tight tracking, H1
  `clamp(2.5rem → 4rem)`, H2 1.875–2.25rem. `.font-display` adds
  `font-stretch: condensed`.
- **Body**: inherited system sans (unchanged — zero added weight).
- **Data**: `font-mono` for handles/IGNs in the hero proof panel.
- **Deviation**: no webfont procured (M0 allowed a fallback stack; the
  zero-new-dependency constraint won). A licensed condensed face can replace
  the head of `--font-display` later with zero component changes.

## Buttons & links — `src/components/marketing/cta-button.tsx`

`MarketingCTA` (Next `Link`, `href: Route` so dead routes fail typecheck):
`accent` (solid red), `dark` (ink solid), `ghost-on-dark`, `ghost-on-light`.
All: `min-h-[44px]`, full-width stacked on mobile (`sm:w-auto` inline), visible
`focus-visible` rings tone-matched (white ring on arena — slate-on-dark would
vanish). Radii sharp (`rounded-sm`); pills only for status chips.

## Navigation — `src/components/shared/site-header.tsx`

Sticky paper header (works over light product pages too): SVG brand mark +
wordmark, `Discover players` (/players), `About` (/about), secondary
`Settings` utility link, accent `Explore players` CTA. Mobile: `Menu`/`Close`
disclosure button (`aria-expanded`/`aria-controls`), `hidden`-toggled panel,
link click closes the menu. The legacy `Opportunities` span is **removed**
(M0 M1-2) — unshipped domains live only in the homepage RoadmapStrip.

## Footer — `src/components/shared/site-footer.tsx`

Arena band: brand + positioning, honest availability paragraph, `Explore` nav
(Home / Discover players / About — all shipped), copyright with dynamic year,
consent footnote. No social URLs or contact details (none exist).

## Section primitives — `src/components/marketing/section.tsx`

`MarketingSection` (`section[aria-labelledby]` + `SectionEyebrow` with red
tick): tones `paper | steel | arena`, `max-w-5xl` container kept from the
existing `Container` rhythm, `py-14 / sm:py-20`.

## Responsive & motion foundations

Compositions collapse without page-level horizontal scroll (`min-w-0`,
`flex-wrap`, `grid` → single column under `sm`/`lg`); CTAs stack full-width on
mobile; hero H1 clamps to 2.5rem. Global `prefers-reduced-motion` guard kills
non-essential animation/transitions. No ambient animation ships at all.
