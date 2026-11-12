# 07 — Implementation Roadmap

Constraints respected: frozen G1 paths untouched, no Supabase changes, no
signup/onboarding build, no new dependencies in early phases, no commits or
deployments in M0.

## M1 — Truthful foundation (first)

1. Rewrite home copy to the `02` classification (remove implied
   recruitment/news/tournament/mini-game availability).
2. Remove or gate the "Opportunities" header span.
3. Define Direction-A tokens + display typography in `globals.css`; restyle
   header/footer; extend `routes.test.ts` static-audit to marketing.
4. Gates: copy-accuracy review, a11y test gates from `06`.

## M2 — Arena home

Build the `04` component set and `/about`; directory preview via the real
public RPC path (or projection-shaped static mock — never real user rows).
Keep product/app routes visually aligned but functionally untouched.

## M3 — Audience expansion (gated per domain)

Teams/orgs/brands/opportunities pages ship only with their domains; until
then they live exclusively in the home RoadmapStrip labeled "Coming soon".

## M4 — Polish & proof

Brand imagery/OG, sitemap, performance budget (LCP < 2.5s on 4G, zero
layout shift in hero), reduced-motion audit, Lighthouse ≥ 95 a11y.

## Out of scope until G1-8B

Any signup/onboarding CTA, session-aware header, or publish promise.
