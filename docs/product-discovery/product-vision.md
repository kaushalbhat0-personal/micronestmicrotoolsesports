# Product Vision

## Positioning

**[Confirmed]** MicroNest Esports — *Discover the people, teams, organizations and brands shaping esports.*

**[Confirmed]** Discovery and connections are the primary product. News, tournaments, and mini games are supporting sections. Anything that competes with discovery for attention is out of scope for the MVP.

**[Confirmed]** Initially India-focused and BGMI-first. **[Recommendation]** Architecture must support additional titles without redesign (title as a first-class entity from day one, not a hardcoded `bgmi` literal — the legacy finder hardcoded `game = bgmi` and that mistake must not be repeated).

## The seven pillars

### A. Players **[Confirmed]**

Players create a competitive profile (identity + titles + competitive information), discover other players and recruiting teams, express interest in vacancies, and are discoverable by teams, organizations, and brands.

**[Recommendation]** Profile fields should be: handle, display name, avatar, region/city, languages, timezone, titles played, per-title game identity (IGN + game ID), role(s), availability, looking-for flags, short bio. **[Recommendation]** Do not invent skill ratings, ranks, or competitive verification. Self-reported levels may exist only if always labelled self-reported; no numeric scores.

### B. Teams **[Confirmed]**

Teams manage a profile (game, identity, roster), discover and recruit players, publish vacancies, and are discoverable by organizations and brands.

**[Recommendation]** Support both independent teams and organization-owned teams/divisions from the domain model (see `domain-model.md`), even if organization-owned teams ship in a later phase.

### C. Organizations **[Confirmed]**

Organizations manage a profile, ownership, and administrators; run multiple teams/divisions; discover and recruit players, teams, and staff (coaches, managers, analysts); publish vacancies; receive applications.

**[Recommendation]** Role-based access (owner / admin / recruiter-or-manager / member) is a foundation requirement, not a later addition — recruitment without permission boundaries produces impersonation risk.

### D. Brands **[Confirmed]**

Brands manage a profile, are discoverable, discover ecosystem entities, and publish vacancies, sponsorship, or partnership opportunities.

**[Recommendation]** Never conflate these five distinct things: (1) public brand profile, (2) verified brand representative, (3) historical esports involvement, (4) actively published opportunity, (5) confirmed partnership. **[Risk]** Fabricating sponsorship interest or contacts destroys trust; the platform must make "no active opportunity" an honest, normal state.

### E. News (supporting) **[Confirmed]**

Minimum viable editorial model: categories, title association, article publish/manage, sources/attribution, editorial admin. **[Recommendation]** Staff-written editorial only for MVP; no aggregation engine, no comments.

### F. Tournaments (supporting) **[Confirmed]**

Discovery only for MVP: title, organizer, dates, format, entry requirements, registration info/link, status. **[Recommendation]** Do not operate registration, brackets, or payouts in v1. **[Assumption]** Tournament records later become competitive evidence on profiles; keep a loose reference, not a hard dependency.

### G. Mini games (supporting) **[Confirmed]**

Engagement layer that complements discovery. **[Confirmed]** Legacy `bgmi-lab` / Loot Dash reviewed as concepts only. **[Recommendation]** No new games during MVP; integrate later as profile-linked engagement (e.g. game activity as soft discovery signal), never as a competing product.

## Non-goals for MVP

**[Recommendation]** Explicitly deferred: social feed, public comments, chat/messaging beyond a short application note, payment/escrow, player skill scores, sponsorship claims without evidence, multi-title depth beyond data-model readiness, microservices, CRM features, tournament operations.
