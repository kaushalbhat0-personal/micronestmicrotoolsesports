# P8 discovery relationships

Conceptual model without premature sensitive writes. Platform identity stays
independent of game-specific profiles; a single user identity may eventually
hold multiple roles (no duplicate identities, no org/brand substitute
accounts).

## Entities

- User identity (existing `app_users`; unchanged).
- Player profile (G1; unchanged).
- Team (`teams`; `owner_user_id`/`created_by` session-derived; `organization_id`
  reserved TEXT, no FK in D1 — still no FK in P8).
- Organization (PROPOSED; no table in P8).
- Brand (PROPOSED; no table in P8).
- Tournament organizer ref (denormalized `independent | organization` + name +
  nullable slug, `verified: false` frozen; NOT a registry — unchanged).

## Required conceptual relationships

| Relationship | Meaning | P8 state |
|---|---|---|
| Organization → Teams | Org may own/manage multiple teams | Publicly readable as `team_count` only; association writes DISABLED; never silent |
| Team → Organization | Team may be independent or org-associated | Independent is valid + discoverable at `/teams`; no forced linkage |
| Organization → Recruitment opportunities | Org hiring/tryouts | NOT YET SUPPORTED (unavailable note; no filter, no posts) |
| Brand → Sponsorship interests | Declared intent (`sponsorship_interests`) | Publicly readable as intent; NOT availability |
| Brand → Sponsorship opportunities | Concrete postings | NOT YET SUPPORTED (unavailable note) |
| Player → Public visibility | Opt-in discoverability | Existing G1 behavior, unchanged |
| User → Organization/Brand roles | Ownership, admin, representative | NOT YET SUPPORTED (no duplicate identities; no substitute accounts) |
| Tournament → Organizer | Denormalized ref | Existing P3 behavior, unchanged; P9 will decide registry linkage |

## Read/write matrix

- Publicly readable now (via proposed RPCs once applied): org/brand search
  columns + detail public fields; org `team_count`; brand declared interests.
- Owner-managed: NONE in P8 (no owner model accepted).
- Representative-managed: NONE in P8.
- Admin-reviewed: NONE in P8 (states exist for display; transitions disabled).
- Not yet supported: org ownership/administration, team↔org association
  writes, recruitment posts/applications, brand verification + evidence,
  sponsorship postings, contact/inquiry handoffs, claims.

## Guardrails applied

- Teams never silently attach to an organization (count-only display +
  independence note).
- Brands never imply supply (interest ≠ availability) or representation
  (profile ≠ authority).
- Tournament organizer publishing stays out of P8 entirely (P9).
