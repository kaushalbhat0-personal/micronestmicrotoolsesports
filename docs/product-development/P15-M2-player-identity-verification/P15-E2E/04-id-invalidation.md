# 04 — ID-change invalidation

## Verified (JWT)

| Step | Result |
| --- | --- |
| After pending, player changes BGMI ID | Case → `id_mismatch` via trigger |
| Approve blocked while mismatched | PASS |
| After approve, player changes BGMI ID | Approved case → `id_mismatch` |
| Public reader after change | `ownership_reviewed=false` |
| Stale approved public status | None |
| Claimed snapshot immutable | Prior M2B.3B/4 guards; new ID requires new submission |

## Product rule confirmed

Old evidence / old claim cannot approve a drifted live ID. Player must start a new submission after correcting the ID.
