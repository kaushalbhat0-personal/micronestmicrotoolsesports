# Personas and Roles

## Core distinction

**[Confirmed / Recommendation]** There is one authenticated **User** (Supabase Auth row + `profiles` row). Everything else — player profile, team membership, organization role, brand representation — is a relationship attached to that user, not a separate login. Do not create separate account types per role.

| Concept | What it is | One user can have… |
|---|---|---|
| User | Auth identity + `profiles` row | exactly one |
| PlayerProfile | Personal competitive profile | one (recommended; multi-game via GameProfiles) |
| Team membership | Roster row on a team | many (play for several teams) |
| Organization membership | Role in an org | many orgs, one role each |
| Brand representation | Verified link to a brand | many (rare; usually one) |
| Platform admin / editor | Global grant | at most one grant row |

## Personas

- **Visitor** **[Confirmed]**: anonymous; browses public finder pages and SEO surfaces; cannot apply or publish.
- **Registered player** **[Confirmed]**: signed-in user with a PlayerProfile; the default identity. **[Assumption]** Most users are players first; team/org/brand roles attach later.
- **Team owner/manager (captain)** **[Confirmed]**: player who administers a team; publishes vacancies; reviews applications.
- **Organization owner** **[Confirmed]**: created the org; full control including deletion and ownership transfer; the only role that can grant owner.
- **Organization administrator** **[Confirmed]**: manages teams, members, vacancies; cannot delete org or remove owner.
- **Organization recruiter** **[Recommendation]**: scoped role — publish vacancies and review applications, no member management. **[Open]** Whether recruiter is a distinct role or an admin flag (see `open-decisions.md`).
- **Brand representative** **[Confirmed]**: verified link between a user and a brand; publishes brand opportunities. Distinct from merely claiming employment.
- **Platform administrator** **[Confirmed]**: existing `platform_admins` pattern reused; handles verification queues, reports, news/tournament publishing.
- **News editor** **[Recommendation]**: platform-admin-scoped capability for articles, not a separate account type.
- **Tournament organizer** **[Assumption]**: initially an external party whose events are listed editorially; self-serve organizer accounts deferred. **[Open]**

## Representative vs entity

**[Recommendation]** Every action on behalf of a team/org/brand must resolve to: authenticated user → membership/representation row → permission check → action. Display the acting entity ("Recruiting for Team X"), but authorize the user. Never trust client-supplied `organization_id`/`team_id` without a membership check — this mirrors the legacy `requireOrganizationContext` discipline.

## Multiple-entity management

**[Recommendation]** Yes to all of these (see `domain-model.md` for mechanics): one user manages multiple entities; a player manages/captains a team; a team exists independently of an org; an org has multiple divisions and admins; a brand has multiple representatives; ownership transfer and account deletion follow explicit rules (transfer-then-delete; org with no owner is blocked at the database level, reusing the existing `enforce_organization_owner_count` pattern).
