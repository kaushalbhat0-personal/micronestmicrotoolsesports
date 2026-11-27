# P9 owner decisions

All genuinely sensitive operations stay disabled until these are approved.
Numbers are stable across phases (D- = carried, P9- = new).

## Carried (still open)

- **D-G1-03/D-G1-04**: public projection masking posture — P9 follows it.
- **D1-D3/D1-D10**: workspace write authority + migration application flow.
- **D1-D7**: verification semantics (applies to organizers now too).
- **D1-D9**: report queue retention/visibility (tournaments need it before
  publish enables).
- **P3 owner items**: schema/ownership acceptance, organizer-permission
  model, verification semantics, moderation boundary, report retention, SLA.

## New in P9

1. **P9-01 — Organizer model acceptance.** Confirm the independent-organizer
   registry (`organizers` + `organizer_members`) as the accountable identity
   for `tournaments.created_by`, including single-owner launch.
2. **P9-02 — Organization linkage.** Approve or reject the explicit
   `organization → organizer` linkage: consent flow, which side initiates,
   whether org admins gain organizer rights (recommended: never automatic).
   Until decided, linkage stays null and independent organizers proceed.
3. **P9-03 — Professional operator class.** Approve the `professional` type's
   verification bar, or remove the value from the vocabulary.
4. **P9-04 — Moderation authority.** Name the reviewers (platform admins?),
   the review SLA, the queue retention/visibility rule, and takedown power.
   Nothing publishes until this lands.
5. **P9-05 — Verification policy.** Evidence types, handling, retention,
   approver roles, and expiry for organizer `trust_state` transitions.
6. **P9-06 — Migration application.** Authorize applying 05 + 06 remotely
   (after disposable-replay RLS verification) and the backfill rule for
   historical denormalized organizer refs.
7. **P9-07 — Rejection representation.** Confirm submitted → draft return
   (no stored `rejected` state) and where return reasons live.
8. **P9-08 — Retention.** Confirm no-delete posture for tournaments and the
   archival rule (who, when, how long unpublished rows persist).
9. **P9-09 — Organizer media.** Approve artwork ownership/scope/moderation
   before any logo/banner column or upload surface.
10. **P9-10 — Directory filter for organizer tournaments.** Approve a
    `p_organizer_slug` filter (or equivalent) so profiles list tournaments
    precisely instead of via name query.
