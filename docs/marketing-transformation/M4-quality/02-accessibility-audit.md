# 02 — Accessibility Audit (Gate 2)

Target: WCAG 2.2 AA. Scanner: **axe-core 4.14.0** (already present in
`node_modules` as a transitive dependency — injected via `addScriptTag`, no
new dependency installed), run-only tags `wcag2a wcag2aa wcag21a wcag21aa
wcag22aa`, on `/` + `/about` at 390px and 1440px against production.
Cross-check: Lighthouse 13.6.0 accessibility category ×4 (see `03`).

## Findings and fixes

**F1 — color-contrast (serious), 5 nodes, home only.** Ghost numerals
(`text-steel-200 #E2E8F0` on white, ~1.2:1) in the ecosystem rail and BGMI
subline. They are `aria-hidden` and informationally redundant (order carried
by `<ol>` semantics + headings), but axe flags them and the M0 bar is
axe-clean — fixed, not waived. Fix: new `--color-ghost: #7E8CA0` token
(**3.42:1**, passes the 3:1 large-text threshold; both usages are ≥36px
extrabold display type), documented in `globals.css` as large-display-only.
Rerun: **0 violations**.

**F2 — skip-link focus ring.** First Tab stop reached the skip link but showed
only the UA default ring (`1px auto`). Fix: explicit
`focus-visible:outline-2 … outline-accent-600` in `layout.tsx`. Re-verified in
the keyboard walkthrough (all 14 stops `2px solid`).

## Rerun results (post-fix, production)

| Config | Violations | Passes | Incomplete |
|---|---|---|---|
| `/` 390 | **0** | 27 | color-contrast ×2 (see below) |
| `/` 1440 | **0** | 25 | color-contrast ×2 |
| `/about` 390 | **0** | 24 | — |
| `/about` 1440 | **0** | 22 | — |

**Incomplete review (not waived blindly):** the 2 nodes are the decorative
`→` glyphs (`aria-hidden`) inside directory links — identical computed
color/background to the adjacent link text that axe *passed*
(`accent-300`/arena 8.59, `accent-600`/paper 5.88). Safe by construction;
documented, no code churn for a scanner heuristic.

## Manual checks (all evidenced in the sweep JSON)

- **Headings**: one H1 per route, H2 per section via `aria-labelledby`, H3
  cards/rows — no skips.
- **Landmarks**: header/nav/main/footer + labelled navs (Primary/Mobile/Footer).
- **Keyboard**: 14-stop walkthrough — skip link → brand → Primary nav →
  hero CTAs → … → footer; logical order, every stopline visibly outlined.
- **Disclosure**: `aria-expanded`/`aria-controls` managed state (button
  header); verified open/close via real clicks in `04`.
- **Names**: every link/button named (brand `aria-label`, icon `aria-hidden`,
  avatar pattern untouched on product pages).
- **Images**: zero content images on marketing routes (SVG brand mark
  `aria-hidden` + labelled link); product `alt` rules untouched.
- **Motion**: `prefers-reduced-motion: reduce` emulated — media matches and
  CTA `transition-duration` collapses to `0.01ms`; no ambient animation ships.
- **Contrast ledger**: accent/paper 5.88, white/accent 5.88, hover 7.82,
  accent-bright/arena 8.59, ghost/paper 3.42 (large only), steel-ink/steel
  9.45, ink-600/paper 7.58. Raw accent on arena (3.29) remains banned for text.

## Limits (explicit, not claimed)

No screen-reader walkthrough (NVDA/VoiceOver unavailable in this environment)
and no axe run on product routes beyond the frozen G1 evidence. Lighthouse
a11y scored **100 on all four runs** — reported as a scanner score, not as
WCAG conformance by itself.
