# Authorization Matrix **[Proposed]**

Actors: ANON, AUTH (signed-in, no roles), PLAYER (own profile), TEAM (owner=captain / member), ORG (owner/admin/recruiter), BRAND (verified rep), PUBLISHER (captain/admin/recruiter/rep on owning entity), APPLICANT, MODERATOR (platform admin queue powers), ADMIN (platform super-admin). S=select, I=insert, U=update, D=delete/soft-delete. Public views are masked projections; base tables never world-readable.

## Discovery & profiles

| Domain | ANON | AUTH | PLAYER | TEAM owner/member | ORG roles | BRAND rep | APPLICANT | MOD/ADMIN |
|---|---|---|---|---|---|---|---|---|
| Public player/team/org/brand views | S (consented only) | S | — | — | — | — | — | — |
| Own player/game profile base | — | — | SIUD | — | — | — | — | MOD: verification reads; ADMIN: audit |
| Others' private fields (contacts, IDs, evidence) | — | — | — | — | — | — | — | MOD evidence reads only |
| Team internals (roster, non-open posts) | — | — | — | S (member) / SIUD (owner) | — | — | — | — |
| Org internals (members, drafts) | — | — | — | — | S (member) / manage (admin) / full (owner) | — | — | — |
| Brand internals (reps, drafts) | — | — | — | — | — | S / manage (admin-scope) | — | — |

## Opportunities & applications

| Domain | ANON | AUTH | Publisher side | Applicant side | MOD/ADMIN |
|---|---|---|---|---|---|
| Open approved opportunities | S | S | SIUD own drafts + publish/pause/close | — | takedown |
| Draft/paused/removed opportunities | — | — | S own entity | — | S queue |
| Publish vacancy (team/org) | — | — | I iff captain/admin/recruiter on owner | — | — |
| Publish brand opportunity | — | — | I iff verified rep + brand verified (triple gate) | — | — |
| Apply / withdraw | — | I own + U-withdraw own while active | — | SI own only | — |
| Review queue (applicants+notes) | — | — | S for own opportunities; decide (shortlist/accept/decline) | — | — |
| Competing applications | — | — | — | never visible | MOD reads for disputes |

## Trust, content, notifications

| Domain | Rule |
|---|---|
| Verification submissions | owner I (+delete own while pending); MOD review reads + writes; evidence never public |
| Reports | reporter I + S own; MOD triage; no owner U/D |
| Strikes | MOD I; publisher S own; ADMIN ban actions |
| News/tournaments published | world S; editor (admin-scoped) SIUD; drafts internal |
| Notification queue | owner S + mark-read U; system I via service-role |
| Audit logs | member/admin reads per scope; no client writes (service-role only) |

## Ownership validation (every write)

Authenticated user → membership/representation row → role/scope check → entity match on the target row. Client-supplied entity ids are never trusted without the membership join. Recruiter: vacancies + application review only — member management, publishing as another entity, and settings are denied (mandated test in `testing-strategy.md`).
