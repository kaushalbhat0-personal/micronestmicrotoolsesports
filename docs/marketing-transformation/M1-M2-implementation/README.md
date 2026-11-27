# M1–M2 Implementation — Marketing Foundation & Arena Homepage

Product: MicroNest Esports · Branch: `new-platform` · Scope: M1 + M2 only.

## What shipped

- **M1 design foundation**: marketing-scoped Tailwind v4 theme tokens, condensed
  display typography (zero-dependency system stack), button/link primitives,
  responsive header with mobile disclosure menu, arena footer, section
  primitives, reduced-motion guard.
- **M2 arena homepage** (`/`): hero, ecosystem intro, player-discovery proof,
  four audience pathways, BGMI-first band, Coming-soon roadmap strip,
  closing CTA — fully static, no signup CTA.
- **M2 about page** (`/about`): positioning, problem, vision, audiences,
  BGMI direction, availability statement.
- **Tests**: `src/components/marketing/marketing.test.tsx` (14 tests:
  module boundary, no-signup, coming-soon labelling, nav, render contracts);
  `e2e/home.spec.ts` updated to the new homepage.

## Files in this folder

1. `01-design-system-implementation.md` — tokens, type, components (Gate 1).
2. `02-homepage-implementation.md` — homepage sections (Gate 2).
3. `03-about-page-implementation.md` — about page (Gate 3).
4. `04-responsive-accessibility.md` — responsive + a11y evidence.
5. `05-product-marketing-accuracy.md` — truthfulness mapping (Gate 4 support).
6. `06-test-evidence.md` — test/build/lint/evidence log (Gate 5).

## Gate verdicts (summary)

| Gate | Verdict |
|---|---|
| 1 — Design foundation | PASS — tokens/components consistent, product tokens untouched |
| 2 — Homepage | PASS — competitive identity, truthful positioning, live directory linked |
| 3 — About | PASS — no fabricated company/product claims |
| 4 — Regression | PASS — directory, profile, settings routes + tests intact |
| 5 — Quality | PASS with noted limits — build/typecheck/lint/unit green; screenshots captured (see `06`); no axe/Lighthouse run claimed |

## Constraints honoured

No commits, pushes, deployments or Supabase changes. No auth-flow changes, no
signup/onboarding, no new dependencies (`package.json` untouched). Marketing
code imports no Supabase client, reader, repository or domain module —
enforced by `marketing.test.tsx` (extends the `routes.test.ts` audit idea to
the marketing layer). Pre-existing modified/untracked files preserved.
