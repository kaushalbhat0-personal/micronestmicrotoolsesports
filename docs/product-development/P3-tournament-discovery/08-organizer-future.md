# P3 Organizer Integration Requirements + Next Phase

## Why no organizer routes ship in P3

Organizer routes were proposed conditionally ("only if they can be built
without assuming unresolved organization permissions"). They cannot — not
safely:

1. **Organizer identity is undecided.** Publishing must attribute a
   listing to *someone* accountable (`created_by` equivalent), but whether
   that someone is a bare user, an independent-organizer profile, or an
   organization member is open. Any route built now would freeze the wrong
   shape.
2. **Organization authority is explicitly excluded** (D1-D4 analogue):
   org membership must never imply tournament rights, and no org tables
   exist. An org-scoped route would imply the authority it must not have.
3. **Moderation is undesigned.** Publishing without a report queue,
   reviewer SLA, and takedown path invites abuse listings with no recourse.
4. **Verification is undesigned.** Any organizer profile page today would
   either fake trust or permanently brand organizers "unverified".

So P3 ships the discovery half (usable now) and the publishing contracts
(validated, gated), with routes deferred.

## Requirements for organizer integration (P4)

- Owner decision: organizer model (accountable identity for `created_by`;
  independent vs organization membership; whether orgs own listings).
- Owner decision: verification semantics + display (D1-D7 analogue).
- Owner decision: moderation boundary — report queue schema/retention,
  reviewer permissions, takedown/unpublish authority, SLA.
- Data-model acceptance + migration + RLS execution matrix (04 checklist).
- Flip: kill switch + wire publish/update/unpublish actions (session +
  active-account gates, same pattern as P2 Gate 3) + organizer dashboard
  routes (list own listings, edit locked-identity fields, unpublish with
  reason) + E2E.
- Marketing follow-up: homepage roadmap still lists Tournaments as
  "Planned" — reword only after liveness, never before.

## Recommended next phase (P4)

**P4 — Organizer workspace (gated):** decide the organizer model +
moderation boundary, accept + migrate the 04 proposal, then build the
organizer dashboard behind the same kill-switch discipline. Recruitment
operations (P2/P3 follow-ups) interleave only after D1-D3/D1-D12 land.
