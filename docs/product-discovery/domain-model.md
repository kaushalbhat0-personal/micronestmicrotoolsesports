# Domain Model (Logical)

Candidate names are logical, not mandatory table names. For each: purpose, key fields, relationships, ownership, lifecycle, visibility, authorization.

## Identity and profiles

- **User** — auth identity (`auth.users` + `profiles`). Fields: id, email, display name, avatar. Owns own row only.
- **PlayerProfile** — one per user **[Recommendation]**. Fields: handle (unique), display name, region, languages, timezone, levels (self-reported), roles, availability, looking-for flags, bio, avatar, indexing consent. Lifecycle: draft → searchable → hidden. Visibility: masked public projection. AuthZ: owner writes; world reads public projection.
- **GameProfile** — per-title identity **[Recommendation]** (this fixes the legacy BGMI-only hardcode). Fields: user, game → GameTitle, IGN, game ID (masked publicly), verification status/method/date. One user → many GameProfiles (one per title). Verification writes are reviewer-only.
- **GameTitle** — catalogue row (BGMI first, more later). Fields: slug, name, roles list, ID format hint, active flag. Admin-managed.

## Teams and organizations

- **Team** — independent or org-affiliated **[Recommendation]**. Fields: slug, name, game, region, description, level window, captain, recruiting flag, contact mode, public flag, owning org/division (nullable). Lifecycle: active → archived. AuthZ: captain writes; members read internals; world reads public projection.
- **TeamMembership** — roster rows (captain/co-captain/player/sub + game role). Owner: the team; user can leave; captain can remove.
- **Organization** — existing table reused. Fields: name, slug, logo, owner, timezone. Lifecycle: active → archived (never hard-deleted with members).
- **OrganizationMembership** — existing pattern (owner/admin/member + proposed recruiter). Guards: last-owner protection, owner-transfer flow.
- **OrganizationTeam (Division)** — links a team into an org **[Recommendation]**. Fields: org, team, division/game label, since. Allows one org → many divisions; a team has at most one owning org at a time (independence flag otherwise).

## Brands

- **Brand** — public entity. Fields: slug, name, category, description, logo, website, verification state, active-opportunity flag.
- **BrandRepresentative** — verified user↔brand link with scope (admin/recruiter) and verification evidence. Many reps per brand allowed.

## Opportunities and interest

- **Opportunity** — shared engine (see opportunities doc). Fields per §core + type + status + expiry. Publisher: team/org/brand. Visibility: open = world-readable; else publisher-internal.
- **Application (Interest)** — applicant → opportunity with status lifecycle; one active per pair. Applicant sees own; publisher sees its queue; nobody sees others'.
- **Verification** — submissions queue (evidence path private, reviewer-only reads).
- **Report** — polymorphic target + reason + triage status; reporter sees own; admins see queue.

## Content and engagement

- **NewsArticle** — category, title associations, body, sources/attribution, status (draft/published/archived), author/editor, published-at. Editor writes; world reads published.
- **Tournament** — title, organizer, dates, format, entry requirements, registration info/link, status. Editorially managed for MVP (self-serve organizer accounts deferred).
- **TournamentParticipation** **[Recommendation, deferred]** — loose link from team/org/player to tournament as competitive evidence (self-reported + source link). Not a v1 dependency.
- **Notification** **[Recommendation, deferred]** — in-app queue (pending counts, status changes). Email/push deferred; model the queue early so UI hooks exist.

## The 10 structural questions

1. **One user, multiple entities?** **[Recommendation]** Yes — memberships/representations, with an entity switcher.
2. **Player also manages a team?** Yes — captaincy is a membership role, not a separate account.
3. **Team independent of org?** Yes — owning-org nullable; independence is a first-class state.
4. **Multiple game divisions?** Yes — via OrganizationTeam rows.
5. **Brand, multiple reps?** Yes — BrandRepresentative rows with scopes.
6. **Org, multiple vacancies?** Yes — Opportunity rows per team/division/staff/brand-type.
7. **One opportunity, different applicant types?** **[Recommendation]** No — one target type per opportunity; publishers post sibling opportunities per audience. (Cross-type acceptance is a moderation smell.)
8. **Player, multiple game profiles?** Yes — GameProfile per title.
9. **Multiple admins per entity?** Yes — with last-admin/owner guards.
10. **Deletion and transfer?** **[Recommendation]** Account deletion requires transferring owned entities first (or explicit cascade-abandon with audit); org/team/brand deletion is soft (archived) preserving audit trails; ownership transfer is accept-gated and logged.
