# Scope Freeze Proposal

Per phase: frozen IN vs explicitly OUT. Anything not listed is out by default until proposed.

## Foundation (identity, profiles, ownership, permissions) — PROPOSED FROZEN

- **In:** User/PlayerProfile/GameProfile/GameTitle(BGMI), Teams + memberships, Organizations + memberships (owner/admin/recruiter per D-02) + divisions, entity switcher, ownership transfer, last-owner guards, masked public views, audit logging, notification queue model.
- **Out:** Vacancies, applications, brands, content, email delivery, chat, paywalls.

## Player/Team discovery — PROPOSED FROZEN

- **In:** Both finders with specified filters/sorts/SEO, team vacancies, player applications + withdraw, captain review queue, pointer-only invitations, factual fit lists, expiry rule, in-app pending counts.
- **Out:** Org hiring, brands, staff flows, email, scores/rankings, direct messaging.

## Org recruitment — PROPOSED FROZEN

- **In:** Org Finder, divisions, org vacancies (player/team/generic-staff), team-applications, required compensation framing, moderation fields, duplicate warnings.
- **Out:** Brand/sponsorship semantics, payments, contracts.

## Brand discovery/opportunities — PROPOSED FROZEN

- **In:** Brand profiles, representative verification (publish-gated), Brand Finder, partnership/sponsorship opportunity types, interest + application flows, honest "no active opportunity" states.
- **Out:** Payments, contracts, messaging, unverified publishing.

## News / tournaments — PROPOSED FROZEN

- **In:** Editorial article CRUD + attribution + title links; tournament discovery pages fed editorially with external registration links.
- **Out:** Aggregation, comments, syndication, brackets, payouts, organizer self-serve.

## Mini games — PROPOSED FROZEN

- **In:** Nothing until discovery proves out; then profile-linked engagement reusing legacy concepts, no new designs.
- **Out:** New games, leaderboards-as-identity, prizes.

## Global non-goals (all phases)

Social feed, public comments, chat/DMs, escrow/payments, skill scores, unverified sponsorship claims, tournament operations, microservices, CRM. Reintroducing any requires a new decision entry (D-20+), not scope creep.
