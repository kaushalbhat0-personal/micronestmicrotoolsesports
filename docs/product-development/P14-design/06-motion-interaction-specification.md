# 06 — Motion / Interaction Specification

Primary: **CSS-first + Motion for React (single dep, at implementation)**. No GSAP/Anime.js. No installs in B1.

## Evaluation

- CSS: sufficient for hover, focus, `animate-pulse` skeletons, show/hide, `prefers-reduced-motion` guard. Zero bundle cost. Limit: no layout/shared-element, no interruptible gestures.
- Motion for React: declarative, React 19-safe, WAAPI/spring hybrid 120fps, `layout`/`layoutId`, `AnimatePresence`, `whileInView`/`whileTap`, tree-shakable. Fits filter/tab underlines, card press, dialogs/menus, list reorder. Recommended.
- Anime.js: strong timelines but imperative refs/cleanup; no React advantage for directory UI. Reject as primary.
- GSAP: best scroll-scrub/timelines but bundle + plugin/`useLayoutEffect` overhead + Club licensing review. Reject; marketing has no ambient animation per `globals.css:84-86`.

## Tokens

- Durations: `instant 80ms` (press), `quick 120ms` (row indicator, hover), `base 160ms` (dialog/popover fade-scale), `panel 220ms` (drawer, spring), `reveal 280ms` (`whileInView` once, 16px rise). No long loops.
- Easings: `ease-out cubic-bezier(0.16,1,0.3,1)` (enter), `ease-in-out` (reorder), springs `stiffness 400 / damping 34` (panels), `stiffness 550 / damping 40` (press `whileTap 0.98`).
- Springs only via Motion; CSS uses easings above.

## Behaviors

- Page transitions: none (App Router default; preserve scroll). Optional `AnimatePresence` fade 120ms on filter result swap only.
- Navigation: instant; mobile panel conditional render + 160ms fade; `aria-expanded` sync; focus moves to panel heading on open, returns on close.
- Cards: hover left/top 4px red indicator 120ms + `translateY(0)` (no lift/shadow); `whileTap` 0.98 on runners.
- Dialog/menu (Radix): `AnimatePresence` fade+scale 160ms; Esc/outside close; focus trap preserved.
- Filters/tabs: `layoutId` underline 180ms; results `role=status` announce; skeleton `animate-pulse` during fetch; no layout thrash.
- Tools: input → live output 120ms highlight; copy/export confirms via `role=status` text (no toast lib); `progressbar` for tiebreak/roster compute.
- Loading: skeletons only (existing pattern); route `loading.tsx` added at implementation (B2) reusing `results-skeleton`.
- Mobile touch: 44px targets retained; `whileTap` replaces hover; no hover-only disclosure.
- Reduced-motion: existing guard (`globals.css:87-96`) extended to Motion via `useReducedMotion()` → disable `whileInView` rise, layout anims, shimmer; preserve state changes instantly.

## Implementation notes (B2)

1. `npm i motion` + `import { motion, AnimatePresence, useReducedMotion } from "motion/react"`.
2. Centralize in `src/components/ui/motion.ts` (durations/easings/springs) — no scattered magic numbers.
3. Dialogs keep Radix primitives; style via arena tokens (shadcn pattern copy, not dep).
4. E2E: extend `helpers.ts` with `prefers-reduced-motion` emulation + `expectNoHorizontalOverflow` on animated filter swaps.
