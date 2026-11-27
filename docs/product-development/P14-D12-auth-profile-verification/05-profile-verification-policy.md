# 05 — Profile Verification Policy (P14-D12)

## Supported onboarding statuses (live)

Derived only — never stored as a verification badge:

| Status | Meaning |
|---|---|
| `not_started` | No `player_profiles` row |
| `incomplete` | Profile exists; D-G1-08 completeness incomplete |
| `complete` | Self-reported completeness satisfied |

`isVerified` is **always false** for these states.

## Planned statuses (not implemented — no schema)

| Status | Why deferred |
|---|---|
| `pending_verification` | No player verification case table |
| `verified` | Would falsely imply trust if mapped to self-report |
| `rejected` | No review/rejection workflow for players |

**Do not invent these as live UI gates.** Product copy must never claim a
self-reported profile is verified.

## Recommended simplest sustainable process

Prefer an **admin-reviewed** path that reuses platform patterns — not a
third-party KYC SaaS.

### Submission

1. Owner completes self-reported profile (`complete`).
2. Optional later: upload evidence objects to `private-verification/{uid}/…`
   (bucket already exists; owner RLS path-scoped).
3. Create a `player_verification_cases` row (future migration) with status
   `pending`, referencing `app_users.id` — mirror organizer `verification_cases`
   shape, **not** tournament/organizer entities.

### Review

- Super-admin / platform admin via existing `is_super_admin()` + active
  `app_users` gate.
- Workspace moderation shell can gain a player-verification queue later;
  current moderation queue is tournament/organizer-only and writes are OFF.

### Approval / rejection / resubmission

- Approve → `verified` + audit append.
- Reject → `rejected` + reason code + allow resubmit to `pending`.
- Never write verification claims into the frozen 12-column public projection.

### Audit history

- Append-only admin audit (`admin_audit_logs` pattern) for decisions.
- No silent status flips without actor + timestamp.

### Privacy of evidence

- Keep evidence in `private-verification` (not public projection, not anon-readable).
- Reviewers use elevated server paths only; never expose evidence URLs in
  directory RPCs.

## What shipped now

Policy helpers + documentation + onboarding completeness flow.
**No migration applied. No RLS/grant change. No verification SaaS.**
