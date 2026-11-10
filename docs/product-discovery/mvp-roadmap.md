# MVP Roadmap (Proposed)

Order is dependency-driven, not the suggested order accepted blindly: the brand graph reuses the opportunity engine built for teams/orgs, so it follows — but brand *profiles* can ship alongside orgs since they share the entity pattern. News/tournaments/mini games stay supporting throughout.

## Phase 0 — Live-project parity + domain approval **[Recommendation]**

- Value: de-risks every later phase.
- Scope: read-only live Supabase checks (migration parity, RLS status, buckets, auth settings); approve domain model + RLS boundaries + opportunity engine shape.
- Out: any migration or code.
- Acceptance: parity report + approved `open-decisions.md`.
- Risk: drift between repo migrations and hosted project.

## Phase 1 — Foundation: identity, profiles, ownership, permissions

- Value: every later feature stands on this.
- Scope: User/PlayerProfile/GameProfile/GameTitle (BGMI seeded, multi-title-ready), Teams + memberships, Organizations + memberships + divisions, entity switcher, ownership transfer, last-owner guards, masked public views, audit logging.
- Out: vacancies, applications, brands, content.
- Acceptance: one user manages player + captained team + org role; public views mask PII; owner transfer audited.
- Risk: permission-model churn if recruiter role undecided — decide in Phase 0.

## Phase 2 — Player and Team discovery

- Value: the core loop (find players, find teams) works end to end with applications.
- Scope: Player/Team Finder (filters, sorting, empty states, SEO), team vacancies, player applications + withdraw, captain review queue, fit explanations (no scores).
- Out: org-level hiring, brands, staff roles.
- Acceptance: journeys 1–3, 7, 13, 14 pass with private rosters and masked views.
- Risk: filter bloat; hold the line on the specified field sets.

## Phase 3 — Organization discovery and recruitment

- Value: orgs hire players, sign teams, recruit staff.
- Scope: Org Finder, divisions, org vacancies (player/team/staff types), team-applications, org vacancy management.
- Out: brands, sponsorship semantics.
- Acceptance: journeys 4–6, 8 pass; independent vs org-owned states correct.
- Risk: staff-role scope creep — ship coach/manager/analyst as one generic staff type first.

## Phase 4 — Brand discovery and opportunities

- Value: ecosystem completes (money and partnerships enter honestly).
- Scope: Brand profiles + representative verification, Brand Finder, partnership/sponsorship opportunity type with compensation framing, interest + application flows, shortlisting.
- Out: payments, contracts, messaging.
- Acceptance: journeys 9–12 pass; unverified brands cannot publish; "no active opportunity" renders honestly.
- Risk **[Risk]**: fabricated sponsorship — verification-before-publish and report SLAs are launch gates.

## Phase 5 — News (editorial MVP)

- Value: supporting content + SEO.
- Scope: categories, title association, article CRUD, sources/attribution, editor role, published listing + article pages.
- Out: aggregation, comments, syndication.
- Acceptance: editor publishes with attribution; articles link to titles; drafts invisible.

## Phase 6 — Tournaments (discovery MVP)

- Value: event discovery + future competitive-evidence anchor.
- Scope: tournament listing + detail (organizer, dates, format, entry, registration link, status), title association, admin/editorial management.
- Out: registration, brackets, payouts, self-serve organizers.
- Acceptance: visitor finds tournament → understands how to enter externally.
- Risk: pressure to operate tournaments — resist until discovery proves out.

## Phase 7 — Mini games integration

- Value: engagement without competing with discovery.
- Scope: reuse BGMI Lab/Loot Dash *concepts* behind profile-linked engagement; no new game designs in this roadmap.
- Out: new games, leaderboards-as-identity, prizes.
- Acceptance: games link to profiles; activity is an optional soft signal, never a score.

## Deferred explicitly

Social feed, comments, chat, escrow/payments, skill scores, unverified sponsorship claims, self-serve tournament operations, multi-title depth, microservices, CRM.
