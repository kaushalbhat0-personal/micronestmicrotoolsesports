# 01 — Editorial Product Scope

## Coverage

MicroNest News covers:

1. Esports industry news.
2. Game-specific news (BGMI first).
3. Tournament announcements and results.
4. Team and player updates.
5. Platform announcements.
6. Editorial guides and explainers.

## Non-goals (this phase)

- No live scores, brackets, or prize distribution (tournament operations).
- No rumors or transfer confirmations without a sourced announcement.
- No AI-generated content without an explicit editorial workflow (no such
  workflow is approved; nothing in P4 generates article text).
- No comments, reactions, or reporting flows ( moderation arrives later).

## Multi-title posture

- BGMI is the first supported title (existing game catalogue).
- No other titles are seeded.
- Articles may be platform-wide (`game_key = null`) or attached to exactly
  one supported game key (`bgmi` today).
- Planned titles (e.g. `mlbb`) are rejected with an explained empty state,
  never silently accepted or coerced to BGMI.

## Content honesty rules

- Never invent real news, results, achievements, sources, quotations, or authors.
- Sample fixtures exist ONLY in tests and local previews, prefixed `TEST`,
  and never render as published production content.
- Empty states say "No stories are published yet" — never placeholder stories.
- Unavailable states say "News unavailable / Story unavailable" — never a
  fake 404 and never internal database detail.
