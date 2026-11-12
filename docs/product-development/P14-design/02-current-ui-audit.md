# 02 — Current Visual Audit (P14-B1 Phase 2)

Scope: homepage + implemented directory/profile/workspace routes. No files modified. Separates confirmed findings (C) from subjective opportunities (O).

## Homepage (`/`)

- C — Hierarchy works: arena hero (H1 `Where esports talent gets discovered`) → proof panel → Ecosystem → PlayerDiscovery → AudiencePathways → BgmiBand → RoadmapStrip → ClosingCTA. Single H1, eyebrow `BGMI-first · Multi-title ready`.
- C — Typography: `font-display` condensed uppercase for H1/section heads; body system sans. No webfont; fallback stack renders narrower on Windows (Arial Narrow) vs macOS. Display sizes use `clamp(2.5rem,7vw,4rem)` — good fluid scale.
- C — Color: paper/steel alternating + `arena-950` bands; accent used sparingly (CTA, markers, Live pill). Contrast comments verified (accent/paper 5.88, white/accent 5.88). Ghost numerals `aria-hidden` only — correct.
- O — Rhythm is even but section eyebrows repeat the same `tracking-[0.18em]` pattern; consider varying density for editorial vs proof sections (Hallmark/Unslop anti-pattern check).

## Directories (players/teams/orgs/organizers/brands/tournaments/news/tools)

- C — Consistency strength: every directory = `*_filters` + `*_results` (`role=status`) + `*_pagination` (`aria-label`) + `*_card` (`article aria-labelledby`) + `results-skeleton` (`animate-pulse` + `aria-hidden`). Shared query/columns pattern per feature.
- C — Filters: labels above inputs, `min-h-[44px]`, `focus-visible:outline-2`. Trust vocabulary (`Verified/Community`) consistent.
- C — Image gap: no photography/avatars except `player-avatar` initials fallback; cards are text-dense. No broken `<img>` — strength (honesty over fabrication), but art direction is the largest premium gap.
- O — Tables vs cards diverge by feature (tournament-card vs team-profile-sections). Unify to one density scale in design system.

## Profiles (`[handle]/[slug]`)

- C — `profile-sections` + `*-detail` + `related-stories` share `aria-labelledby` section pattern. Good landmark structure.
- C — Missing states handled: scoped `error.tsx`/`not-found.tsx` per pillar; `role=alert` for query errors.
- O — No `loading.tsx`; navigation falls back to skeleton components only after data layer mounts. Add route-level loading to avoid layout shift.

## Tools workspace (`/tools/[slug]` runners)

- C — Runners (`tiebreak-runner`, `roster-builder-runner`, `prize-pool-runner`) are functional-first, keyboard-accessible, with e2e coverage (clipboard stub, overflow check, 390×844 mobile).
- O — Visual language is utilitarian vs marketing arena; needs Tools workspace composition (Phase 4/5) without losing density.

## Navigation / responsive / a11y

- C — Strengths: skip-link, `aria-expanded/controls` mobile menu, `aria-current/disabled` pagination, `role=status/alert`, 44px targets, `focus-visible` everywhere, `color-scheme: light` explicit, reduced-motion guard.
- C — Responsive: `max-w-5xl` container + `sm/md/lg` only; `md:flex hidden` nav switch; mobile menu is full-width stacked list. No horizontal overflow (e2e asserts).
- C — Risks: light-only (no dark); `dark:` variant name in `cta-button` is a color variant, not mode — document to avoid confusion. No `next/image` optimization; avatar `unoptimized`.

## Loading / empty / error / unavailable

- C — Skeletons present per directory/workspace; empty (`No players match…`) and error (`role=alert`) strings are honest (no invented counts). `unavailable-state.test.ts` guards.
- C — Gap: 0 `loading.tsx`; `sitemap` excludes product routes (correct for now, revisit at launch).

## Performance risks

- C — Zero animation deps, `optimizePackageImports: lucide-react`, `typedRoutes`. Low JS risk.
- O — If Motion/GSAP added naively, bundle + 120fps risk. Keep CSS-first (see 06). Missing OG images limits sharing; do not fabricate — produce real art per 07.

## Summary

Strengths: honest copy, consistent directory system, strong a11y baseline, static marketing shell, test-backed tools.
Confirmed gaps: product token layer (slate defaults), no loading routes, no imagery/OG, no webfont, light-only.
Subjective: unify card/table density, vary eyebrow rhythm, elevate Tools workspace visually.
