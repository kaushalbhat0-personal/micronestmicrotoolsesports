# Trust and Moderation

**[Risk]** Fake recruitment and fabricated sponsorship are the fastest way to kill this platform. Trust design is a launch requirement, not polish.

## Verification (three separate things)

1. **Identity/account verification** **[Recommendation]**: proves control (game ID ownership via evidence review; org domain check; brand domain/social proof). Says nothing about skill or intent.
2. **Representative verification** **[Recommendation]**: proves a user may act for an entity (captaincy, org role, brand authorization letter/domain email). Required before publishing as that entity.
3. **Opportunity verification** **[Recommendation]**: listing passed moderation (first-listing review + spot checks). Badged with method + date.

**[Confirmed]** Platform verification is always distinct from user-submitted claims. Self-reported levels, histories, and achievements are labelled as such everywhere they appear (legacy `self-reported` discipline retained as concept).

**[Recommendation]** Do not promise what we cannot do: no skill certification, no KRAFTON/rank endorsement, no background checks, no automated brand legitimacy scoring.

## Impersonation prevention

- **[Recommendation]** Unique handles/slugs + verified-badge display; name-squatting review queue.
- **[Recommendation]** Claiming an existing entity (team/org/brand name) triggers a claim flow with evidence, not instant ownership.
- Org ownership transfer requires explicit acceptance; last-owner removal blocked at database level (existing pattern).

## Listings and claims

- Fake recruitment listings: report category → takedown within SLA **[Open: SLA]** → publisher strike count → repeat offenders lose publishing rights.
- Misleading sponsorship claims: brand opportunities require compensation framing (explicit range, fixed, revenue-share, or unpaid/trial); blank promises rejected at validation. Historical involvement must be sourced (links), else shown as "self-reported".
- Never fabricate interest, contacts, or endorsements — including in empty states, seed data, and marketing copy.

## Contact privacy, spam, blocking

- **[Recommendation]** No public emails/phones. Contact happens via in-platform interest → publisher reveals their stated method only after `shortlisted`/`accepted`.
- **[Recommendation]** Rate limits on search, applications (per-day cap **[Open]**), and reports; application note length-capped; duplicate-application guard doubles as spam control.
- **[Recommendation]** User blocking: block hides your public profile from the blocked user and prevents their applications to your vacancies. Profile visibility toggle (`looking_for`/`recruiting`/`open`) is respected everywhere including SEO (de-index on toggle).

## Reports and moderation queue

**[Recommendation]** Report targets: player, team, org, brand, vacancy, opportunity, application/note. Reasons include impersonation, fake listing, misleading sponsorship, spam, abuse, other (free text). Triage by platform admins; evidence never publicly visible; reporter gets status (received → reviewing → resolved/dismissed) without exposing moderator internals.
