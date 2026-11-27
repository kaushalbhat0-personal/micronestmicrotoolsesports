# P8 — Organization & Brand Discovery

Status: implemented as safe public-discovery shells on proposed read contracts (no migration applied, no writes enabled).

## Contents

1. `product-scope.md` — objectives, non-goals, acceptance bar.
2. `organization-domain.md` — organization domain contract.
3. `brand-domain.md` — brand domain contract (distinct from organizations).
4. `discovery-relationships.md` — relationship model and read/write matrix.
5. `trust-and-verification.md` — trust states and presentation rules.
6. `routes-and-components.md` — routes, query boundaries, components, nav.
7. `database-and-security-contracts.md` — proposed projections/RPCs, RLS sketch, disabled operations.
8. `test-evidence.md` — filled after the quality gates run.
9. `owner-decisions.md` — decisions taken in-phase vs questions for owners.
10. `next-phase-recommendation.md` — recommended P9 scope.
11. `README.md` — this index.

## Reconnaissance summary (Phase 0)

- Player directory (`/players`) is live on the approved G1 RPC-only projection (frozen 12 columns).
- Team directory (`/teams`) ships on the local-but-UNAPPLIED D1 masked RPC pair; reads resolve to unavailable states until applied. P8 follows the same posture.
- Tournament discovery (`/tournaments`) ships on a PROPOSED RPC pair with no migration; P8 copies this pattern exactly.
- Game catalogue is BGMI-only (`bgmi` supported, `mlbb` planned); per-game region vocabularies are enforced at the reader layer for known games.
- No organization or brand tables exist. `teams.organization_id` is a reserved text field with no FK (D1). Storage reserves a `public-entity-media` bucket but no domain media contract is accepted — hence no logos in v1.
- Tournament `organizer` is a denormalized public ref (`independent | organization`) with `verified: false` frozen; P8 does not reuse it as an organization registry.
- Navigation exposes players/teams/tournaments/news/tools; organizations and brands were roadmap-only. P8 adds them to header/footer.
- Prior direction (directory + recruitment/sponsorship discovery, multi-team orgs, independent teams, representative verification, submitted/reviewed/confirmed separation) is honoured as presentation-only: recruitment availability and sponsorship availability are explicitly unavailable; verification transitions are disabled.

## What is functional vs presentation-only

Functional now: public directories + profiles as thin shells with search/filter/pagination parsing, honest empty/invalid/unavailable states, trust presentation, safe external-link validation, responsive accessible UI, navigation.

Presentation-only (disabled by design): organization ownership/administration, team↔org association writes, recruitment posts, brand representative verification, verification approval/rejection, evidence uploads, profile claims, contact/inquiry handoffs, sponsorship postings. Attempted writes hit `*WriteDisabledError` domain gates; no route, action, or RPC exists for them.

## Database status

No migration applied in P8 (constraint). `08-database-and-security-contracts.md` is the acceptance target: proposed tables, masked RPC pair per pillar, RLS sketch, grants. Routes read only through the proposed RPC names; with no migration they resolve to the generic unavailable state — never fake rows.
