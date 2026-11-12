# 04 — Organization & Verification Boundaries (D1-D4 / D1-D5 / D1-D6 / D1-D7 / D1-D8)

## Organizations (D1-D4): reference ≠ authority

`organization_id` is a stored text reference with zero authorization meaning:
no policy reads it, no helper consumes it, no grant depends on it. Granting
organization members any team right requires designed org tables, membership
RLS, and a precedence rule (owner vs org-admin) — none exist, none implied.
Approving (b) keeps this wall; approving (c) commissions that design.

## Vocabulary (D1-D5): BGMI-first, multi-title-ready shape

Closed sets ship for roles, regions (incl. `online` as game-server value, never
a country), and play-modes. New titles follow the frozen D-G1-09 recipe:
catalogue row + CHECK + validation — canonical identity untouched. Matching
must use vocabulary codes, never legacy broad-region tokens.

## Tiers (D1-D6): self-reported context, never achievement

Tiers render only beside "self-reported" copy. No sorting, badges, or claims
may treat them as verified skill. A verified ladder is a separate product with
evidence and reviewers — explicitly out of D1.

## Verification (D1-D7): what it is not

Deferred entirely. Nothing in D1 is "verified": not email (mailbox control
only, per D-G1-10), not accounts, not teams, not ownership, not organizations.
Any future verification gets its own decision, columns, and audit — it must
never be retrofitted onto `is_visible`/`is_public`.

## Availability (D1-D8): bounded shape, open words

Recommended (b): array shape preserved, max 7 entries (G1 parity),
per-element length bound, GIN index for filtering. The word list itself stays
open until usage justifies closing it; closing is a second decision with the
list attached.
