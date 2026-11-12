# Product Scope (P5)

## In scope

1. A public tools directory (`/tools`) with search, category and game filters.
2. Reusable tool landing pages (`/tools/[slug]`) with an inline runner for
   functional tools and an honest coming-soon state otherwise.
3. A reusable, feature-first tool architecture: add tools without modifying
   unrelated tools or global navigation logic.
4. One genuinely functional, deterministic tool suitable for launch:
   the Prize Pool Splitter.
5. A consistent, accessible, mobile-first execution experience with clear
   validation, explainable results, recalculation and reset.
6. No-login local execution for tools that can safely run locally.

## Out of scope (this phase and by pillar design)

- Payments, prize distribution, escrow, or custody of funds (calculation only).
- Paid entitlements, subscriptions, pricing, billing rails.
- Persistent user data, history, share links, accounts for tools.
- Live broker, game, or tournament integrations; third-party credentials.
- Leaderboards-as-identity, chat, feeds, or mini-games (separate pillars).
- Porting legacy engines: legacy Prize-Splitter / Tie-Breaker / Payout /
  Draft-Ban code is RETIRE-classified (A0–A1) and was **reimplemented fresh**,
  never imported.

## Multi-esports posture

- Tools are game-agnostic by default: the Prize Pool Splitter is
  platform-wide (`gameKeys: null`) and matches every game filter.
- Game-specific tools may declare supported keys; planned titles are
  recognized by the filter vocabulary but match nothing until supported.
- The platform-wide identity system is untouched: tools require no identity
  at all.

## Audience

- Primary: BGMI tournament organizers and team managers planning payouts.
- Secondary: community admins and orgs running cross-title events.
