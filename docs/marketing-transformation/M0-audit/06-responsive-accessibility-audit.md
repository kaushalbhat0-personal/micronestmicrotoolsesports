# 06 — Responsive & Accessibility Audit

## Current state (good bones)

Product surfaces already meet a high bar (G1-6 evidence): semantic
landmarks (`h1`/`article`/`dl`/`nav`), labeled controls, keyboard-native
elements with visible focus rings, skip link, `role="status"`/`alert`
announcements, no color-only signaling, responsive grids collapsing at
`sm`/`md`, `min-w-0` + truncate discipline. No `overflow-x` risk found.
Preserve all of it; the transformation must not regress these.

## Findings for the marketing pass

1. Mobile nav: fine today (2 links). Rule: beyond 4 header items, ship a
   disclosure menu — never shrink links into overflow.
2. Hero composition (new): H1 ≤ 4rem clamp, subcopy ≤ 2 lines on 360px,
   CTAs full-width stacked on mobile, directory preview strip becomes a
   single snap-scroll card row — no horizontal page scroll.
3. Cards: `PlayerCardPromo`/audience cards keep `min-w-0`, wrapped chips,
   44px touch targets, text fallback for missing avatars (existing pattern).
4. Typography: display face must hold at 360px — test condensed uppercase
   at H1 clamp minimum; eyebrows never below 12px; line-length ≤ 65ch body.
5. Contrast: accent red on near-black and white must pass 4.5:1 for text;
   accent used for large graphics/borders only where it fails text contrast.
   Steel-on-white metadata ≥ 4.5:1.
6. Motion: `prefers-reduced-motion` disables all non-essential animation;
   streaming skeletons keep `aria-label` announcements (existing pattern).
7. SEO: keep `noindex` on players/settings until an indexing decision
   exists; new marketing pages get full metadata + OG (once brand imagery
   exists) + canonicals; add sitemap entries only for shipped routes.

## Test gates for every marketing phase

Axe-clean product comparison, 360×740 + 768 + 1440 visual pass, keyboard
walkthrough, reduced-motion pass, Lighthouse accessibility ≥ 95.
