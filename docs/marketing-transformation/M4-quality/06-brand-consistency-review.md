# 06 — Brand Consistency Review (polish, not redesign)

Scope guard: no visual direction change. Verified against the locked
Direction A (arena dark / editorial light / one red / condensed display).

## Token audit (all consumed, none orphaned except noted)

- `arena-950/900/800` + `arena-line`: hero, roadmap, footer, proof panel —
  consistent, no new dark values introduced anywhere.
- `paper / steel-100 / steel-200`: section rhythm paper → steel → paper →
  paper → arena → paper holds; product slate scale untouched.
- `accent-600/700/300`: CTAs, LIVE badges, eyebrows, keylines, seed numerals
  (pathways), footer-free (footer uses paper text — correct restraint).
- **`--color-ghost` (new, M4)**: `#7E8CA0`, approved for large aria-hidden
  display numerals only; `text-steel-200` no longer colors any text
  (`grep` clean). `steel-ink` remains available-but-unused — acceptable
  reserve, not drift.
- No gradients, glows, borders-for-decoration, or second accent hue found in
  sources or screenshots.

## Typography / components / chrome

- Display: condensed uppercase 800, H1 clamp / H2 scale, eyebrows 12px
  tracked — uniform across `/` + `/about` (screenshot comparison).
- Body 1rem/1.625, mono for handles/IGNs only.
- `MarketingCTA` four variants used consistently (accent primary, dark on
  steel, ghosts per background); 44px targets verified in DOM audit.
- Header (brand + 2 primary + Settings utility + accent CTA; disclosure <
  768px) and footer (brand + availability + 3-link index + consent footnote)
  identical on both routes.
- Section transitions and mobile/desktop hierarchy reviewed in the 15
  screenshots — no drift.

## M4 source changes (polish ledger)

1. `globals.css`: +`--color-ghost` (documented constraint).
2. `ecosystem.tsx`, `bgmi-band.tsx`: ghost numeral class swap (visual delta:
   numerals slightly darker — intended, still watermark-grade).
3. `layout.tsx`: skip-link focus-visible ring.
4. `site-header.tsx`: reverted details experiment → verified button header
   (pixel-identical to M1–M2; see `03` for rationale).
5. `src/app/sitemap.ts`: new (no visual surface).

## Licensed condensed font

Recorded as a **future optional upgrade, not a blocker**: the system
condensed stack (`--font-display` head replaceable) already reads competitive
at 360–1440px. When brand budget allows, drop a licensed face (e.g.
Oswald/Archivo-class) into the stack head — zero component changes, then
re-verify LCP/font-display and the ghost-token ledger (unchanged hues, but
re-run axe as routine).
