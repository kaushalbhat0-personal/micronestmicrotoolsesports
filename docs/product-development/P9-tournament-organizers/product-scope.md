# P9 product scope

## Objective

Connect the existing P3 tournament discovery experience to real organizer
identities and a controlled tournament publishing workflow — discovery and
promotion only, never tournament operations.

## In scope

1. **Organizer discovery**: `/organizers` (search, country/region filter, game
   filter, organizer-type filter, trust presentation, bounded pagination,
   published-tournament counts) and `/organizers/[slug]` profiles (identity,
   description, games, region, links, trust status, published tournaments).
2. **Organizer domain**: display name, unique handle/slug, description,
   country/region, website + social links, supported titles, approved-only
   contact surface, trust/verification status, derived published count.
3. **Authorization foundation**: session-derived identity, active-account
   gates, owner/admin/editor roles, platform-moderator separation, no
   caller-supplied authority, immutable ownership/creation metadata.
4. **Workspace**: `/workspace/organizer`, `/workspace/organizer/tournaments`,
   `/workspace/organizer/tournaments/new`,
   `/workspace/organizer/tournaments/[id]/edit` — strict Zod forms, validation
   feedback, live preview, disabled persistence with honest notices.
5. **Publishing lifecycle proposal**: Draft → Submitted → Published →
   Unpublished → Archived, with the moderation-gated transitions disabled in
   code and blocked in the migration trigger.
6. **Database proposal**: two local migrations (organizer registry +
   tournament link), RLS, narrow grants, masked RPCs — not applied remotely.
7. **P3 integration**: tournament cards/detail link to organizer profiles when
   a registry slug exists; profiles surface published counts and link back.
   No denormalized name is treated as identity proof.

## Non-goals (explicitly out)

- Tournament operations: brackets, scheduling, scoring, live results.
- Payments and prize distribution (fees/pools are display-only minor units).
- Internal registration, applicant tracking, contact handoffs with PII.
- Verification pipelines, evidence uploads, self-approval flows.
- Organization↔organizer auto-conversion or permission inheritance.
- Media uploads beyond the existing `public-entity-media` reservation.
- Mini Games (deferred pillar).

## Acceptance criteria

- Organizer directory/profile render honest empty, unavailable, invalid and
  404-equivalent states; no fabricated organizers, counts or badges.
- Only `confirmed` trust renders a confirmation indicator.
- All mutations validate strictly and resolve to the disabled-boundary state
  (no fake success).
- No cross-organizer reads or writes; no caller-supplied identity; no
  privilege escalation path in code or migration.
- Existing P3/P8 projections unchanged in shape; extensions documented.
- `npm test`, `typecheck`, `lint`, `build` green; P7.1 e2e unaffected.
