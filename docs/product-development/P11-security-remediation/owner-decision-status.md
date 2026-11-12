# P11 owner decision status

No owner approval was sought or granted in P11. Every decision below is
carried over from P9/P10 with its status unchanged. P11 implements nothing
that depends on an approval being granted.

## P9 items (still open)

- **P9-01/P10-01** (independent organizers): PROPOSED — P11 work assumes the
  independent registry only; nothing added for other models.
- **P9-02/P10-02** (organization linkage): PROPOSED — linkage stays null; the
  F-02 freeze covers `organizer_*` denormalized columns so linkage-shaped
  edits cannot ride along on published rows either.
- **P9-03/P10-03** (professional class): PROPOSED-DEFERRED — untouched.
- **P9-04/P10-04** (moderation authority): PROPOSED — P11 **names the same
  authority** (`platform_admins` via `is_super_admin()`) in trigger bodies
  but grants it no new power: the F-01 guard is fail-closed (blocks everyone
  when the authority is empty/unapproved) and the queue has zero policies.
- **P9-05/P10-05** (verification policy): PROPOSED — no evidence intake, no
  approval action, no expiry job built.
- **P9-06** (migration application): NOT GRANTED — all P11 migrations are
  local-only and unapplied, same posture as P9.
- **P9-07/P10-06** (rejection as return-to-draft): PROPOSED — decision audit
  shape finalized in the queue proposal; the relaxing transition is not
  implemented.
- **P9-08/P10-07** (archival/retention): PROPOSED — no delete path added;
  retention duration still open.
- **P9-09/P10-08** (media/evidence uploads): PROPOSED-DEFERRED — queue DDL
  contains no evidence columns by design.
- **P9-10/P10-09** (organizer filter): PROPOSED — not implemented.

## P11-specific positions (no approval claimed)

- **F-03 recommendation** (`admin_provisioned`): RECOMMENDED BY P11, NOT
  APPROVED. No provisioning code, policy, or grant ships in P11 — the
  recommendation is inert until owners approve the power and the tooling.
- **F-02 strict default** (zero non-material fields): PROPOSED DEFAULT.
  Relaxing any field requires owner approval plus a migration edit; the
  trigger makes code-only relaxation impossible.
- **Queue schema**: PROPOSED TARGET. Inert (no policies/grants) so there is
  nothing to approve operationally yet — only the shape is under review.

## What would change these statuses

Owner review of `f03-founder-bootstrap.md` (approve/reject the
admin-provisioned recommendation) and of the moderation-authority package
(P10-04) are the two decisions gating all P12 implementation. Partial
approval is supported: each capability has independent gates.
