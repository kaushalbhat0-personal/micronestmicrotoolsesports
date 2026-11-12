# P8 product scope

## Objectives

Deliver two connected public discovery pillars:

A. Organization Finder — `/organizations`, `/organizations/[slug]`.
B. Brand Finder — `/brands`, `/brands/[slug]`.

Both provide: public directories, search + filters, bounded pagination,
individual public profiles, identity/capability information, trust and
verification presentation, responsive accessible UX, honest empty/unavailable/
unverified states.

Audiences: players, teams, organizations and brands discovering each other.
A single user identity may eventually hold multiple roles; P8 creates no
duplicate identities and no org/brand substitute accounts.

## In scope

- Game-agnostic org + brand domains with BGMI-first compatibility.
- Controlled vocabularies (org type, brand industry, partnership types,
  sponsorship interests, trust states).
- Directory search/filter behavior grounded in actual proposed columns.
- Recruitment/sponsorship sections rendered as explicit unavailable notes
  (no fabricated supply).
- Safe https-only external links with handoff notes.
- Header/footer navigation + discover entry points.
- Proposed (not applied) persistence contracts + security assessment.
- Unit, route-audit, component and regression tests.

## Non-goals (explicitly not built in P8)

- Tournament organizer publishing (P9).
- Organization ownership assignment, team ownership transfer, org admin
  management, brand representative verification, verification approval/
  rejection, evidence uploads, profile claims.
- Payments, billing, entitlements.
- Private contact data, inquiry handoffs, application flows.
- Fabricated profiles, brands, sponsorships, recruitment posts, logos, or
  verification claims.
- Any change to accepted G1–P7.1 domain behavior.
- Any migration, remote DB change, service-role use, base-table reads, or
  broad table access.

## Acceptance bar

- Directories parse, filter, paginate, and fail safe (invalid → explained
  empty; transport/missing-RPC → unavailable; no existence oracle).
- Profiles render only public fields with 404-equivalence for missing/private
  slugs and distinct unavailable handling for transport failures.
- `confirmed` is the only state that renders confirmation; all other states
  render neutral `Unverified` + explicit labels.
- No false verification, no availability claims, no silent team↔org linkage.
- `npm test`, `typecheck`, `lint`, `build` green; e2e attempted with evidence.
