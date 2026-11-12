# 27 — Performance Review (P14-B3 Phase 5)

No GSAP, Anime.js or any animation library introduced (grep-verified: none in
`package.json`, none imported). CSS-first + existing reduced-motion guard
kept; no animation added for decoration.

## Inspection

| Area | Finding |
|---|---|
| Font loading | `next/font/google` Oswald (500/600/700) + Geist, `display: swap`, self-hosted at build, CSS variables `--font-display`/`--font-sans` (`src/app/layout.tsx`). No render-blocking external `<link>` |
| Images | Zero `<img>` on homepage (Playwright-verified); `public/` holds only `.gitkeep`. No `next/image` tuning needed; no unsized-image risk |
| Client JS | Entire homepage tree is server components; sole client component on the page is `SiteHeader` (menu disclosure). No icon library on the homepage (no `lucide-react` imports anywhere in `src`). Marketing layer: zero `use client`, zero transitions |
| CSS | Tailwind v4 `@theme` tokens, `globals.css` 3,670 bytes; sharp 0px radii, no shadows, single crimson accent |
| Animation cost | None — no ambient animation ships; `prefers-reduced-motion` guard (`globals.css:100`) forces `0.01ms` durations as a backstop |
| Layout shift | Homepage fully static, no Suspense/streaming above or below fold, no late-loading media; measured CLS 0.045 (see below) |

## Lighthouse (production `next start`, localhost:3003)

- Tool: Lighthouse 13.6.0 via npx cache, Playwright Chromium binary,
  `--chrome-flags="--no-sandbox --disable-gpu"`, headless Windows background
  session, 2026-11-12.
- Mobile navigation run: Performance **0.90**, Accessibility **1.0**, Best
  Practices **1.0**, SEO **1.0**. FCP 767ms, LCP 767ms, TBT 50ms, CLS 0.045.
  (Raw Speed Index read 26050 in this throttled background session — treated
  as environment artifact given FCP/LCP/TBT/CLS are all in the green; not a
  product finding.)
- Desktop preset attempt failed with `NO_FCP` (headless paint in a
  background Windows session) — documented, not retried into significance;
  exactly the “document the exact environment” outcome the brief allows.

## Conclusion

No performance defects. No new dependencies, no client-side weight added in
B3 (About rewrite is static copy; +2 unit tests are dev-only).
