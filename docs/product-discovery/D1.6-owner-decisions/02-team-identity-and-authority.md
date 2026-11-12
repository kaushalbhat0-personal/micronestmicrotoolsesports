# 02 — Team Identity & Authority (D1-D1 / D1-D2 / D1-D3 / D1-D10)

## Identity rules (what the owner locks by approving D1-D2)

One team = one game, fixed at creation. `slug` unique and immutable,
`game_key` immutable, `owner_user_id`/`created_by` immutable via direct writes
(enforced today at grant + trigger level). Renames and description/level/
recruiting/visibility edits stay captain-editable. Multi-title organizations
are represented as multiple team rows until multi-game is explicitly designed.

## Proposed permission matrix (D1-D3 + D1-D10 — approve or amend as a unit)

| Capability | Owner (`owner_user_id`) | Member `captain` | `co-captain` | Ordinary member | Suspended account |
|---|---|---|---|---|---|
| Edit public team fields | yes | yes | **no** | no | no |
| Publish / pause / close post | yes | yes | **no** | no | no |
| Accept / reject application | yes, via future RPC | yes, via future RPC | **no** | no | no |
| Remove member | yes, via future RPC | yes, via future RPC | **no** | self-leave only (future) | no |
| Appoint / revoke captain | yes, via future RPC | **no** (owner-only) | no | no | no |
| Transfer ownership | initiate (future RPC) | **no** | no | accept if named receiver | n/a |

All "future RPC" cells are currently **denied** (fail-closed); the matrix is the
contract the RPCs must implement — approving it does not build them.

## Edge cases the owner must confirm

1. Owner who is not on the roster still commands via `owner_user_id`
   (roster row ≠ authority). 2. Member-captain removed from roster loses
   authority immediately (RLS re-evaluated per statement). 3. Suspended owner:
   teams freeze for active-gated writes until transfer or recovery — no interim
   actor unless D1-D10 designs one. 4. Deleted owner account: blocked by
   RESTRICT while teams exist (transfer-first); support runbook required.

## D1-D1 interaction

Unlimited memberships make the matrix's "which teams" question per-team local:
authority never aggregates across teams. A per-user cap later does not change
this matrix.
