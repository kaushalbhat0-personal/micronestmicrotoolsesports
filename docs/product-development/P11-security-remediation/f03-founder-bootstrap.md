# F-03 founding-owner bootstrap

## Finding restated

`organizer_members` has no INSERT policy and no INSERT grant (invitation
workflow pending). Flipping `ORGANIZER_WRITES_ENABLED` alone can never create
the founding owner row — and simply adding an open INSERT grant would let any
account mint organizer ownership. No safe bootstrap path exists.

## Alternatives evaluated

### A. Platform-admin-provisioned organizer (RECOMMENDED)

A platform admin creates the organizer row and the founding owner row (bound
to the approved owner's verified session identity) through an audited admin
path, after out-of-band approval.

| Dimension | Assessment |
| --------- | ---------- |
| Required authority | `platform_admins` membership + owner approval of provisioning power |
| Attack surface | No public path exists; surface is the admin account set + the admin tool |
| Replay risk | None from the outside (no token, no claim endpoint); admin double-provisioning is a procedural error, visible in audit |
| Identity binding | Admin binds `user_id` from the verified session (`ensureAppUser`), never from caller input; `created_by` trigger-immutable thereafter |
| Audit | `admin_audit_logs` entry per provisioning (`platform_admin.organizer_provision` shape); append-only |
| Recovery | Admin re-points ownership only through a future transfer workflow; compromise contained by admin-account controls |

### B. One-time bootstrap claim token

An admin issues a single-use, expiring token; the approved user redeems it to
create exactly one organizer with themselves as owner.

| Dimension | Assessment |
| --------- | ---------- |
| Required authority | Admin issuance + owner approval of the token scheme |
| Attack surface | Token interception/theft; claim endpoint exposed to authenticated users |
| Replay risk | Real — requires single-use enforcement + expiry + redemption audit; a leasing bug mints unlimited organizers |
| Identity binding | Strong (redeemer = owner, session-bound) but proves nothing about legitimacy |
| Audit | Issuance + redemption rows required (new tables) |
| Recovery | Revocation list required; stolen-token response is procedural |

More machinery, strictly larger attack surface, for a scale benefit (admin
not per-action) the platform does not yet need. **Not recommended for v1.**

### C. Open self-claim (REJECTED)

Any authenticated user creates an organizer with themselves as owner.

- Attack surface: organization-name squatting, impersonation of real
  organizers, spam registries, trademark abuse — with no pre-review.
- The identity binding is strong (self only) but authorization is absent:
  binding proves *who*, never *whether they may*.
- **Rejected.** Recorded only to show it was considered and refused.

## Recommendation

**Alternative A, admin-provisioned.** It adds no public attack surface, needs
no new token machinery, and keeps every grant of ownership inside the
audited admin boundary. It requires two approvals before implementation:
owner approval of admin-provisioning power, and the moderation-authority
package (the provisioning tool is a moderator-adjacent surface).

## Implementation status: NOT IMPLEMENTED (by instruction)

No owner-claim mechanism, no admin-provisioning tool, no INSERT policy, and
no INSERT grant ships in P11. `src/features/moderation/domain/bootstrap.ts`
records the alternatives and the recommendation with `assertBootstrapAllowed`
throwing unconditionally; `f03-bootstrap-queue.test.ts` pins that no P11
migration adds any policy or grant, the P9 closed posture is preserved, and
no claim/provision code exists. The DDL for alternative A belongs to the
approval-gated migration described in `next-phase-recommendation.md` — not to
this phase.
