# P9 media and verification policy

## Media

The existing `public-entity-media` storage reservation (public reads; writes
service-role-only until domain tables land with scoped admin policies) is
**not** treated as an organizer media policy. P9 adds no organizer artwork
surface:

- No logo/banner column on `organizers` or `tournaments`.
- No upload component, no signed-URL flow, no authenticated storage policy.
- Cards and profiles render an initial-letter mark — no stock imagery, no
  fabricated media, no external hotlinks.

A future artwork contract must define ownership (which member may upload),
scoping (`organizer/{id}/...` paths), moderation (artwork review before
public read), and retention before any upload surface ships. Until then the
safe placeholder is the policy.

## Verification

- Trust vocabulary: `not_submitted | submitted | under_review | confirmed |
rejected | expired`. Only `confirmed` renders a confirmation indicator.
- No verification pipeline exists: no submission flow, no evidence upload,
  no reviewer queue, no approval/rejection action, no expiry job.
- `private-verification` bucket policy is unchanged (owner-scoped
  self-service paths, signed-URL reviewer reads) — no organizer evidence
  may be written there until an evidence-handling contract is approved.
- No private evidence is publicly accessible: evidence fields appear in no
  projection, no reader, no component.
- Domain-only checks (e.g. website URL reachability) are explicitly **not**
  verification and are never presented as such.
- Anti-conflation copy ships on both organizer profiles and tournament
  detail: publishing ≠ confirmation, confirmation ≠ endorsement, and brand/
  organization profiles never prove viewer authority.

## Moderation-adjacent reporting

Tournament detail already states that moderation/reporting arrives later and
that no listing implies endorsement. P9 adds no report button that leads
nowhere.
