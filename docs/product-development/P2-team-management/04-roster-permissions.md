# P2 Roster Interface and Permission Boundaries

## Interface

- Roster cards: membership role (captain highlighted with amber treatment +
  badge), game-specific role (`IGL/Assaulter/Support/Scout`, else "Flexible
  role"), and a "you" marker on the caller's own row.
- Raw `user_id`s are React keys only — asserted absent from rendered HTML
  in `components.test.tsx`. No names, contacts, applicant notes, or
  decision metadata appear (none is read).
- Counts on cards/headers come from exact head-counts, bounded reads
  (limit 50), ascending roster order.
- Empty roster: honest empty state + invitation-boundary note. The owner
  off-roster case (authority ≠ roster row, matrix `02` edge case 1) is
  stated in copy, not papered over.

## Permission boundaries (all enforced as unavailability, not hidden buttons)

| Capability | P2 posture |
| --- | --- |
| Member add / remove | No controls, no RPC (direct INSERT denied migration-side, F-T04) |
| Captain assign / revoke | No controls; owner-only per matrix, no RPC |
| Application-driven insertion | No controls; captain-decision RPC undesigned (D1-D3/D1-D12) |
| Self-leave | Not built (future row in matrix; no delete control renders) |
| Roster `user_id` visibility to teammates | Withheld from render; D1-D12 open point recorded, default-deny kept |
| Organization authority | Never read, never checked, stated non-authoritative in UI |

## Visibility rule actually shipped

Roster reads are member-gated under RLS and resolve through the same
invisible→null mapping as team reads: a non-member probing a uuid roster
URL learns nothing (identical `notFound`).
