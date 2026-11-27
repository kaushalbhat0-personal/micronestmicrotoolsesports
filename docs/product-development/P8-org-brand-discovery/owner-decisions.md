# P8 owner decisions

## Decided in-phase (no owner input needed)

- D-P8-01: No recruitment-availability filter for organizations (ungrounded;
  inventing it fabricates supply).
- D-P8-02: No sponsorship-availability filter for brands; `interest` selects
  declared intent only.
- D-P8-03: No logos in v1 (no accepted media contract; initial-letter marks).
- D-P8-04: Team association is count-only display; independent teams stay
  discoverable; no silent attachment.
- D-P8-05: `representative_verified` frozen `false`; no representative badge.
- D-P8-06: All privileged writes disabled (ownership, association, verification
  transitions, evidence, claims, handoffs).
- D-P8-07: No migration in P8; proposed RPC contracts are the acceptance target.

## Open questions for owners (P9+ input)

1. Organization ownership model: who can create/own/administer an org? Can one
   user own multiple orgs? Can an org have multiple admins?
2. Team↔org association authority: who may link/unlink a team? Does the team
   captain, org admin, or both need to consent? What happens on dispute?
3. Recruitment boundary: do org-level recruitment posts exist separately from
   team posts? Who moderates them?
4. Brand verification policy: what evidence proves representation (and what
   explicitly does not)? Who reviews? Retention + access rules for evidence?
   Does a domain email count, and under what anti-phishing controls?
5. Sponsorship lifecycle: are sponsorship “opportunities” brand-posted listings
   with applications, or editorial content? Moderation + reporting path?
6. Media contract: are org/brand logos user-uploaded (bucket, scanning,
   moderation) or link-only? Size/format/ownership rules?
7. Tournament organizer registry (P9): does an `organization`-kind organizer
   ref link to an org profile? Who may claim it?
8. Indexing posture: directories are `noindex` today (G1 parity). Should
   confirmed org/brand profiles ever be indexable?
