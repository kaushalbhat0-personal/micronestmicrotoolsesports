# P5 — Esports Tools Platform Foundation

Status: **implemented (functional tool + reusable architecture; no database, no monetization)**.

MicroNest Esports gains its fourth live pillar: a Tools directory with a
reusable catalogue architecture and one genuinely functional, deterministic,
locally-executed tool — the Prize Pool Splitter.

## What shipped

- Public tools directory (`/tools`): editorial intro, search, category and
  game filters, honest empty/invalid states, tool cards (name, purpose,
  compatibility, availability — no metrics, no ratings, no testimonials).
- Reusable tool landing (`/tools/[slug]`): value proposition, audience,
  compatibility, inputs/outputs explained, usage guidance, availability, and
  an inline runner when the tool is functional.
- Reusable architecture (`src/features/tools/`): frozen category enum,
  `ToolDefinition` contract, static registry, slug/game matching, versioned
  entries. New tools extend the registry without touching existing tools.
- First functional tool: Prize Pool Splitter v1.0.0 — total pool (INR/USD),
  fixed or percentage rows (1–32 rows, positions 1–64), integer minor-unit
  arithmetic, largest-remainder rounding, unallocated reporting, copyable
  summary, reset, full validation. Runs entirely in the browser.
- Homepage untouched (see `deferred-decisions.md` §1 for why): one working
  tool does not make the tools ecosystem "live" as a pillar claim.

## What did NOT ship (by design)

- No database tables, no RPCs, no Supabase reads, no login, no persistence.
- No payments, escrow, custody, entitlements, pricing, or billing.
- No external APIs, credentials, tracking, or personal-data collection.
- No additional tools beyond the one functional entry (no invented roadmap).

## Map

- `product-scope.md` — scope and non-goals.
- `architecture.md` — reusable tool architecture and extension process.
- `tool-catalogue.md` — categories and registry entries.
- `first-tool-specification.md` — Prize Pool Splitter exact behavior.
- `security-and-privacy.md` — boundaries and audit posture.
- `route-and-component-map.md` — routes and components.
- `test-evidence.md` — tests and results.
- `deferred-decisions.md` — explicitly deferred decisions.
- `next-phase-recommendation.md` — recommended next phase.
