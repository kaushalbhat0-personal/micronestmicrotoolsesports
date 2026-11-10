# MicroNest Esports — Product Discovery

**Status:** Discovery and audit phase. Nothing here is approved for implementation.
**Branch:** `new-platform` at `dc5aee0`. Legacy reference: `ref/legacy-platform/`. Backend: `supabase/` (unmodified).

## Decision status legend

Every statement in this package carries one of these markers:

- **[Confirmed]** — verified from the repository or stated product vision; safe to build on.
- **[Recommendation]** — architect's proposal; requires product-owner approval before it becomes a decision.
- **[Assumption]** — working hypothesis used to unblock analysis; must be validated.
- **[Open]** — explicitly unresolved; see `open-decisions.md`.
- **[Risk]** — something that can derail value, schedule, or trust if ignored.
- **[Needs validation]** — requires a check against the live Supabase project or a product-owner answer.

Do not present **[Recommendation]** items as approved. See `open-decisions.md` for the approval list.

## Reading order

1. `product-vision.md` — what the platform is and is not.
2. `personas-and-roles.md` — who uses it; account vs profile vs entity.
3. `user-journeys.md` — 14 journeys with actor, visibility, failure cases.
4. `discovery-experience.md` — Player/Team/Org/Brand Finder requirements.
5. `opportunities-and-recruitment.md` — the shared opportunity engine question.
6. `trust-and-moderation.md` — verification, impersonation, abuse.
7. `domain-model.md` — logical entities and the 10 structural questions.
8. `backend-reuse-audit.md` — what the existing Supabase backend offers, classified.
9. `rls-and-authorization-model.md` — authorization boundaries (no policies written).
10. `architecture-proposal.md` — modular monolith recommendation.
11. `mvp-roadmap.md` — phased delivery order.
12. `open-decisions.md` — everything awaiting product-owner approval.

## One-paragraph summary

**[Confirmed]** MicroNest Esports is a discovery and opportunity platform for players, teams, organizations, and brands, India-focused and BGMI-first, with news, tournaments, and mini games as supporting sections. **[Recommendation]** Build identity, profiles, ownership, and a shared opportunity/application engine first; add Brand discovery before news/tournaments/mini games. **[Confirmed]** The existing Supabase foundation (profiles, organizations, membership, RLS helpers, billing RPCs) is reusable; legacy microtool tables (sentinel, draft-ban, tie-breaker, payout-tracker, meta-parser, BGMI hub) are not needed for the new product and should be left dormant, not deleted. **[Risk]** The largest risks are fake recruitment/sponsorship claims and over-scoping (chat, feeds, payments, brackets) before trust and discovery work.
