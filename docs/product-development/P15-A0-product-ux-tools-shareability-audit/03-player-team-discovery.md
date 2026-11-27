# 03 — Player & Team Discovery

## Soft vs hard gates (VERIFIED)

| Gate | Type | Evidence |
|---|---|---|
| Browse directories | Open | Public RPCs to anon + authenticated |
| Incomplete profile on `/teams/new` | Soft UI | `canAttemptTeamCreate` in `access-policy.ts` |
| `create_team` | Hard | `auth.uid()`, active `app_users`, `email_confirmed_at IS NOT NULL` |
| Discoverability | Owner consent + RPC | `set_player_discoverability`; not a verification badge |
| Claim verified | Hard deny (app) | `canClaimVerifiedIdentity` always false |

---

## Player journey

### Registration → onboarding — VERIFIED

Signup/login → immediate session (frictionless policy) → `/onboarding/profile` creates player + BGMI game profile (handle, display name, country, bio, IGN, primary role, region, play modes).

**Gap — MISSING on form:** availability windows (schema supports `availability`; onboarding UI does not collect it).

### Profile editing — PARTIAL

| Capability | Status |
|---|---|
| Settings: discoverability, handle, completeness, delete | VERIFIED |
| Update display/bio/country server API | VERIFIED (limited UI) |
| Game profile edit UI after create | MISSING |
| Avatar upload UI | MISSING (server/storage exist) |

### Public profile + directory — VERIFIED

- `/players`, `/players/[handle]`
- Filters: `game`, `region`, `role`, `query`, `page` — **no** availability / LFT filter
- Cards show: display name, handle, IGN, game, primary role, region/country, play modes, availability chips, bio clip
- No contact surfaces, IDs, metrics, or verification claims on cards

### Verification — MISSING by design

Self-reported complete ≠ verified. Planned statuses documented only.

---

## Team journey

### Create / edit / directory — VERIFIED

Public fields include slug, name, game, region, self-reported levels, `recruiting`, member_count, description (detail).  
Workspace roster is member-gated; public detail shows **count only** (“identities unavailable”) — intentional privacy.

### Membership lifecycle — PARTIAL

Owner/captain model and seed captain on create: VERIFIED.  
Invite / leave / transfer / appoint mutation RPCs: **MISSING**.

### Recruitment / open slots — PARTIAL → mostly MISSING

| Layer | Status |
|---|---|
| Team `recruiting` boolean + UI | VERIFIED |
| Recruiting URL directory filter | MISSING |
| `recruitment_posts` / applications tables | MISSING |
| Zod `recruitmentPostSchema` + orphan cards | Present but unmounted |

---

## LFT card field matrix

| Desired LFT field | Live schema / public RPC | Classification |
|---|---|---|
| IGN | Yes | VERIFIED |
| Display name + avatar URL | Yes (avatar may be null) | VERIFIED / PARTIAL |
| Game | Yes | VERIFIED |
| Primary role | Yes | VERIFIED |
| Secondary role | No | MISSING (proposed/legacy only) |
| Device | No | MISSING |
| Play mode | Yes (`play_modes`) | VERIFIED |
| Region | Yes | VERIFIED |
| Competitive experience / levels | Not on player profile | MISSING |
| Availability | Yes in schema/RPC; weak capture UI | PARTIAL |
| LFT / looking_for flag | No (replaced by `is_discoverable`) | MISSING as explicit LFT |
| Public profile URL | Route exists | VERIFIED |

**Feasibility without schema:** High for a PNG/card composed from public projection + URL.  
**Feasibility of full “LFT status” semantics:** Requires product decision — either treat discoverability + availability as LFT, or add an explicit field (migration + RPC review = **BLOCKED** until authorized).

## LFP card field matrix

| Desired LFP field | Live | Classification |
|---|---|---|
| Team identity (name/slug) | Yes | VERIFIED |
| Game / region / levels | Yes | VERIFIED |
| Open for recruitment | `recruiting` boolean | VERIFIED |
| Open position / required role | No table | MISSING |
| Experience expectations | Levels only (self-reported) | PARTIAL |
| Device / play mode requirements | No | MISSING |
| Application / contact destination | No public contact; orphan application UI | MISSING |

**Feasibility without schema:** Recruiting banner card + team URL.  
**Full open-slot workflow:** New structures + authorization — deferred (see roadmap). Do not implement in this audit.

---

## Major findings

### F-DISC-01 — Weak post-create profile completeness loop
- Evidence: onboarding creates game profile; settings lacks game edit/avatar/availability.
- User impact: directories stay thin; share cards underpowered.
- Business impact: reduces matching quality and share pride.
- Complexity: medium. Risk: low if reusing existing server APIs. Action: settings completeness milestone.

### F-DISC-02 — Recruitment boolean without slots
- Evidence: `recruiting` on teams; orphan `RecruitmentPostCard`; security tests assert no open-slot table.
- User impact: teams cannot state *which* role is open.
- Business impact: discovery → application funnel broken.
- Complexity: high (schema/RPC). Risk: high if rushed. Action: defer full LFP posts; ship recruiting card first.

### F-DISC-03 — No external share affordance on profiles
- Evidence: cards link internally; no PNG/share/OG image.
- User impact: players cannot advertise identity outside the site.
- Business impact: growth depends on manual outreach.
- Complexity: medium (client render). Risk: low if public fields only. Action: Share Kit v1.
