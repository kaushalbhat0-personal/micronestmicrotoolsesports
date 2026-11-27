# P8 next-phase recommendation (P9: tournament organizer publishing)

Do NOT claim the Discover pillar complete: organizations and brands ship as
honest discovery shells on proposed contracts; tournament organizers have no
publishing surface yet.

Recommended P9 scope (organizer publishing, deferred from P3/P8):

1. Decide the organizer permission model (who may publish: independent vs
   org-linked; consent for org-kind refs).
2. Accept the tournament data-model proposal, then migrate + verify
   (disposable-replay RLS execution, escaping/clamp probes, anon/authenticated
   callers) before any publish UI.
3. Build publishing + moderation boundaries (draft → published → unpublished;
   reports queue) following the P3 proposal.
4. Decide whether `organization`-kind organizer refs link to P8 org profiles
   and who may claim them (ties to owner-decisions Q1/Q2/Q7).
5. Keep brand/org verification decisions separate — do not bundle
   representative verification into organizer publishing.

Non-goals for P9: org/brand verification pipelines (need evidence-handling
rules first), payments, entitlements.
