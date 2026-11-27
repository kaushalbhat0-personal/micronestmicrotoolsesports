# 03 — Design Resource Evaluation (P14-B1 Phase 3)

No installs performed. Docs/READMEs reviewed; skills used as methods only.

## Hallmark (nutlope/hallmark, MIT)

- Useful rules: Floor (contrast, focus, reduced-motion, no invented facts, phone layout must pass) → Reflex gates (no eyebrow-above-every-heading, no tracked-caps labels everywhere, no single-colored word in H1, no empty-frame pages, no email-signup-every-page, no fake form success) → Finish (craft detail). Build flow: pre-flight (fonts/palette/framework + `design.md`), deal 3 themes, hero-alone review at 8 widths, fresh-context reviewer, `sloplint --render`.
- Audit technique to adopt: `redesign <path>` keeps content/wiring, changes system; `audit <path>` reports only. `sloplint --before/--kept` prevents lost links/handlers.
- License: MIT — free to use/fork/ship. Photo library (755, Wikimedia Commons) is CC0/PD/CC-BY/SA per image; credit on page. No Unsplash/Pexels (AI-tool terms).
- Conflicts: Hallmark outputs self-contained HTML/CSS pages; do NOT replace App Router architecture. Use as review lens + theme-dealing method for Phase 4 only.
- Status: NOT installed locally (`hallmark` 0 hits in `.agents/skills`, `~/.agents/skills`, `~/.claude/skills`). Use methodology without installing per constraints.

## Unslop (heydamir/unslop, CC-BY-4.0)

- Useful rules: find slop first (purple gradients, glows, emoji labels, shouty copy, uneven spacing) → set direction (character, world, 1–2 color moments, signature detail) → passes in order: spacing, color, icons, copy, type, layout, details, visuals, motion.
- Audit technique: audit → propose direction → edit only after approval; story video via Playwright+ffmpeg (do not generate in this phase).
- License: CC-BY-4.0 — must credit Damir Sokolovsky + link repo if adapted. Commercial use allowed with credit.
- Conflicts: none with Tailwind; image-gen via fal/Replicate/OpenAI requires paid opt-in + prompt approval — deferred per asset constraints.
- Status: INSTALLED globally (`C:\Users\91866\.agents\skills\unslop\`). Project adapter: `ui-ux` skill references `ui-ux-pro-max`. Used as redline method only.

## Motion for React (motion.dev, MIT)

- API: `motion.*` (`animate`, `initial`, `whileHover/Tap/InView`, `layout`/`layoutId`, `AnimatePresence`), springs for `x/scale`, tweens for opacity. 120fps via WAAPI/ScrollTimeline fallback to JS.
- Fit: ideal for filter/tab `layoutId` underlines, card hover/press, dialog/menu presence, `whileInView` reveals. Tree-shakable, TS-first.
- Obligation: `npm i motion` (deferred — no installs in B1).

## Anime.js (animejs.com, MIT)

- Powerful keyframe/stagger/timeline engine, DOM/SVG agnostic. No React binding; manual refs/cleanup. Overkill for directory UI; useful only for hero telemetry illustration if ever needed. Not recommended as primary.

## GSAP (gsap.com, Standard Free + Club)

- Best for scroll-scrub storytelling, complex timelines. Requires ScrollTrigger plugin care in React 19/Next 16 (`useLayoutEffect`/`useGSAP`). Bundle + licensing review (Club for premium plugins) outweighs needs. Not recommended.

## shadcn/ui (MIT)

- Copy-paste Radix+Tailwind primitives, composable, own the code. Project already uses `@radix-ui/react-dialog/select`. Adopt patterns (not full system blindly): `button`, `dialog`, `select`, `tabs`, pagination, `sonner`-style feedback — restyled to arena tokens. No dependency install needed (copy patterns at implementation).

## awesome-design-system-components (6igtree, index — licenses vary per system)

- Useful as survey (Atlantis, Carbon, Primer, Spectrum, etc.) for table/filter/pagination conventions. Do NOT copy a system wholesale; multi-title BGMI-first needs own vocabulary (Trust tiers, Game/Role/Region facets). Check each borrowed pattern's license before porting.

## Decision (for 06/08)

CSS-first for 90% (transitions, `animate-pulse` skeletons, `:hover`, focus), Motion for React as the single animation dependency at implementation (layout/filter/dialog/presence), Radix patterns via shadcn styling. No GSAP/Anime.js.
