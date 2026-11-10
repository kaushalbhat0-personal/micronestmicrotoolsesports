# User Journeys

Format per journey: Actor → Start → Required info → Actions → Visibility → Result → Notifications → Failure/edge cases.

**[Confirmed]** Journeys 1–14 are in scope for analysis. **[Recommendation]** Journeys 1–8 ship before 9–12 (player/team/org graph before brand graph); 13 runs throughout; 14 is continuous.

## 1. Player discovers another player

- Actor: registered player (visitors get a read-only variant).
- Start: Player Finder with game/role/region filters.
- Required: searchable public fields only (handle, roles, region, availability, level window).
- Actions: filter → view public card → open public profile.
- Visibility: masked public view (no user id, contacts, evidence).
- Result: shortlist / view only; contact only via a vacancy application, not direct message (no chat in MVP).
- Notifications: none.
- Failure: private/non-searchable profiles never appear; empty filters show honest empty state, not random profiles. **[Risk]** Showing non-consenting profiles destroys trust.

## 2. Player finds a team

- Actor: player. Start: Team Finder / team vacancy list.
- Required: team's open vacancies, game, region, level window, tryout flag.
- Actions: filter → view team → view vacancy → apply with short note.
- Visibility: public teams + open vacancies are world-readable; roster internals member-only.
- Result: application row (`applied`).
- Notifications **[Recommendation]**: team captains see a pending-applications count on next visit; email/push deferred. **[Open]**
- Failure: vacancy filled/closed mid-apply → safe conflict message, no data leak about other applicants.

## 3. Team discovers and recruits a player

- Actor: team captain. Start: Player Finder.
- Required: player looking-for flag true.
- Actions: view profile → invite-to-apply (i.e. share vacancy link) **[Recommendation]** — no direct unsolicited contact in MVP; invitation is a pointer to a public vacancy, not a message. **[Open]**
- Visibility: captain sees same public view as anyone; no extra PII.
- Result: player applies normally (journey 7).
- Failure: player not looking → profile still viewable if public but flagged; no invite action offered.

## 4. Organization discovers a player

- Actor: org admin/recruiter. Start: Player Finder scoped by title.
- Required: same as journey 1 + org vacancy context.
- Actions: shortlist against an org vacancy → player applies.
- Visibility: public only. **[Risk]** Org bulk-scraping: rate-limit search and never expose user ids (see `trust-and-moderation.md`).
- Result: application to org vacancy.

## 5. Organization discovers an independent team

- Actor: org admin. Start: Team Finder (independent-team filter).
- Required: team independence flag, game/division fit.
- Actions: view team → invite to org opportunity (pointer, not message).
- Visibility: public team view.
- Result: team captain applies on behalf of team (journey 8).
- Edge: team already org-owned → show affiliation, disable invite.

## 6. Organization publishes a recruitment vacancy

- Actor: org admin/recruiter with vacancy permission.
- Required: owning team/division (or org-level for staff), role type, game, requirements, application method, expiry.
- Actions: draft → publish (open) → pause/close/fill.
- Visibility: open vacancies world-readable + SEO; drafts member-only.
- Result: vacancy appears in relevant finder + SEO surfaces.
- Failure: duplicate open vacancy for same role/team → warn, require confirmation (duplicate handling, see opportunities doc).

## 7. Player applies / expresses interest

- Actor: player. Start: vacancy page.
- Required: one active application per vacancy per player (partial-unique guard, legacy pattern reusable).
- Actions: apply with optional short note → withdraw while active.
- Visibility: applicant sees own status; publisher sees applicant's public profile + note; applicants never see each other.
- Result: `applied` → `shortlisted`/`accepted`/`declined` lifecycle.
- Notifications: applicant sees status on next visit (MVP); publisher sees pending count. **[Open: outbound email]**
- Failure: vacancy closed → application rejected with safe message; re-apply allowed only after terminal state.

## 8. Team applies to an organization opportunity

- Actor: team captain on behalf of team.
- Required: captain permission on the team; one active team-application per opportunity.
- Actions: apply → withdraw; org side shortlists/accepts/declines.
- Visibility: org sees team's public profile + roster summary; team sees own status.
- Edge: captaincy changes mid-process → application stays with the team, audit-logged.

## 9. Brand discovers a player

- Actor: brand representative (or visitor for public view).
- Required: player discoverability flags; brand-side shortlisting is private to the brand.
- Actions: filter → view public profile → shortlist internally → contact only via a published brand opportunity.
- Visibility: same public view; brand gets no extra PII. **[Risk]** Brands must never see contacts the public cannot.
- Result: internal shortlist; outreach happens through an opportunity the player can choose to answer.

## 10. Brand discovers a team or organization

- Same shape as 9, with affiliation shown (independent vs org-owned, divisions).
- Result: invitation pointer to a brand opportunity.

## 11. Brand publishes a partnership opportunity

- Actor: verified brand representative.
- Required: verification must precede publishing (unverified brands can draft, not publish). **[Recommendation]**
- Required fields: opportunity type (sponsorship/partnership/vacancy), target (players/teams/orgs), game(s), requirements, compensation framing (honest ranges or "unpaid/trial" — never fabricated), application method, expiry.
- Visibility: open opportunities world-readable; drafts brand-internal.
- Result: opportunity listed in Brand Finder + SEO.
- Failure: expired/unverified → auto-unpublish with reason shown to owner.

## 12. Player/team/org expresses interest in a brand opportunity

- Mirrors journey 7/8 with brand as publisher.
- **[Recommendation]** Interest (lightweight, one-click + note) vs Application (structured, role-specific) share one lifecycle engine with different required fields (see opportunities doc).
- Edge: brand opportunity edited mid-cycle → version note on existing interests; never silently change terms.

## 13. Visitor discovers an entity via search engines

- Actor: anonymous visitor from Google/Bing.
- Required: SEO surfaces limited to finder index pages + public entity pages with `index` allowed (players/teams/orgs/brands that opt into indexing; vacancies).
- Actions: land → browse → sign up to act.
- Visibility: only the masked public view is crawlable; no PII, no applicant lists, no evidence.
- Failure: de-index on privacy toggle or closure; canonical URLs stable.

## 14. Registered entity manages profile and opportunities

- Actor: any role-holder on own entity(s).
- Required: entity switcher (one user, many entities).
- Actions: edit profile → preview public view → publish/unpublish → manage vacancies → review applications → transfer ownership.
- Visibility: owner sees everything on own entity; outsiders see public projection.
- Edge: last-admin/owner removal blocked; account deletion requires ownership transfer first.
