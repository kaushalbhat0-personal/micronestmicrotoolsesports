# P10 owner decisions

All items below are **PROPOSED — awaiting owner approval**. Nothing in P10
treats a recommendation as an approval, and no implementation depends on an
approval being granted. "Implementation consequence" always describes the
safe-without-approval path taken.

Numbering is stable: `P10-01…P10-09` map to the nine prompts in the P10 brief
and supersede the corresponding open P9 items (`P9-01…P9-10`) where noted.

## P10-01 — Independent organizers are supported

- **Original question:** Confirm the independent-organizer registry
  (`organizers` + `organizer_members`) as the accountable identity for
  `tournaments.created_by`, including single-owner launch. (Supersedes P9-01.)
- **Proposed recommendation:** Approve. The P9 registry is the smallest
  accountable identity that does not conflate organizers with players,
  organizations, or brands.
- **Security consequences:** Single-owner launch concentrates authority in one
  row; the founding-owner immutability trigger (05) is the compensating
  control. No second-owner promotion path exists, so compromise of the owner
  account cannot be recovered in-product until a transfer workflow is approved.
- **Product consequences:** Solo organizers can launch without recruiting a
  co-owner; team growth waits on the invitation workflow.
- **Status:** PROPOSED — awaiting owner approval.
- **Implementation consequence:** Proceed with the independent path only.
  Organization linkage stays null; `professional` rows are not created.

## P10-02 — Organization-to-organizer linkage requires explicit consent

- **Original question:** Approve or reject the explicit
  `organization → organizer` linkage: consent flow, initiating side, whether
  org admins gain organizer rights. (Supersedes P9-02.)
- **Proposed recommendation:** Approve a dual-consent model: the organization
  admin proposes, the organizer owner accepts, and neither side's existing
  members gain rights on the other side automatically. Until the flow exists,
  `organization_slug` stays null and matching names never imply linkage.
- **Security consequences:** Kills the confused-deputy path where an org
  membership silently becomes tournament-publishing authority. The cost is a
  manual review step per linkage.
- **Product consequences:** Organizations operating tournaments onboard in two
  steps; no silent conversion, no surprise permissions.
- **Status:** PROPOSED — awaiting owner approval.
- **Implementation consequence:** No linkage column, flow, or inference is
  built. The detail field remains null-by-contract; reader tests pin this.

## P10-03 — Professional organizer classification is deferred

- **Original question:** Approve the `professional` type's verification bar,
  or remove the value from the vocabulary. (Supersedes P9-03.)
- **Proposed recommendation:** DEFER. Keep `professional` as a frozen,
  unpopulated vocabulary value; define its verification bar together with the
  verification-evidence policy (P10-05) instead of ahead of it.
- **Security consequences:** Filtering to `professional` honestly returns zero
  rows; no badge, indicator, or elevated trust is rendered anywhere.
- **Product consequences:** No professional tier at launch; no rework when the
  bar is eventually defined.
- **Status:** PROPOSED-DEFERRED — awaiting owner confirmation of the deferral.
- **Implementation consequence:** No professional rows, no bar, no UI tier.
  The enum value stays frozen so filters and cards stay honest.

## P10-04 — Only platform-level moderators can publish or approve verification

- **Original question:** Name the reviewers (platform admins?), the review
  SLA, the queue retention/visibility rule, and takedown power. (Supersedes
  P9-04 and the P9 report-retention item.)
- **Proposed recommendation:** Approve `public.platform_admins` membership
  (via `is_super_admin()`) as the sole moderation authority for
  publish / return / republish / archive and for verification
  confirm / reject / expire. SLA, retention, and visibility rules are still
  open (see `deferred-decisions.md`) — authority is named, operating
  parameters are not.
- **Security consequences:** Naming the authority does NOT grant it power:
  the 06 lifecycle trigger currently blocks moderator-reserved transitions
  for every role including moderators (default-deny). A separately approved
  migration must relax exactly those transitions before any publish can occur.
- **Product consequences:** Nothing publishes until both the authority AND the
  operating parameters are approved; the queue stays a disabled shell.
- **Status:** PROPOSED — awaiting owner approval. No moderator authority is
  invented or exercised by P10.
- **Implementation consequence:** All moderation/verification transitions keep
  throwing the disabled error in code and in the trigger. The workspace shell
  exposes no operational actions.

## P10-05 — Verification requires manual evidence review

- **Original question:** Evidence types, handling, retention, approver roles,
  and expiry for organizer `trust_state` transitions. (Supersedes P9-05.)
- **Proposed recommendation:** Approve manual review against declared
  evidence categories (see `organizer-verification.md`); domain-ownership
  signals alone never suffice; evidence lives in private storage with an
  approved retention rule; approvers are platform moderators only.
- **Security consequences:** Manual review resists bulk fake-confirmation but
  creates a reviewer-capacity bottleneck and a PII-handling obligation for
  stored evidence. No evidence upload surface ships until storage, access, and
  retention policy is approved (P10-08 covers media; the same gate covers
  evidence).
- **Product consequences:** Verification is slow by design; `confirmed` stays
  rare and therefore meaningful.
- **Status:** PROPOSED — awaiting owner approval.
- **Implementation consequence:** Verification stays fully disabled.
  `canTouchVerification()` returns false for every role including moderator;
  this phase additionally documents that the 05 RLS policy set does not
  column-restrict `trust_state` (see `migration-review.md` finding F-01), so
  the approving migration must add a trigger or column-grant guard — the
  application boundary alone is not sufficient.

## P10-06 — Rejected tournament submissions return to draft with a reason

- **Original question:** Confirm submitted → draft return (no stored
  `rejected` state) and where return reasons live. (Supersedes P9-07.)
- **Proposed recommendation:** Approve: rejection is represented as
  `submitted → draft` plus a reason stored in the moderation decision audit
  (future queue tables), never in a lifecycle enum value.
- **Security consequences:** Organizers cannot forge or edit return reasons
  (moderator-written audit rows are append-only and invisible to organizers);
  organizers always see the reason for their own returned submission.
- **Product consequences:** The public enum stays small; the audit trail keeps
  the full history including who decided and why.
- **Status:** PROPOSED — awaiting owner approval.
- **Implementation consequence:** The 06 trigger keeps blocking
  `submitted → draft` (moderator-reserved) until the approving migration
  relaxes it. P10 implements the decision/reason validation shell with the
  gate closed and documents the audit-row shape.

## P10-07 — Archival is soft archival with historical records preserved

- **Original question:** Confirm no-delete posture for tournaments and the
  archival rule (who, when, how long unpublished rows persist).
  (Supersedes P9-08.)
- **Proposed recommendation:** Approve: no tournament row is ever deleted;
  `archived` is terminal and removes directory visibility while preserving
  history; only moderators may archive; retention duration for unpublished /
  archived rows is still open (see `deferred-decisions.md`).
- **Security consequences:** History preservation protects against
  publish-then-vanish abuse (evidence survives takedown), at the cost of
  indefinite storage of organizer-submitted content until a retention duration
  is set.
- **Product consequences:** Removed listings resolve to honest not-found /
  removed states; audit history is never rewritten.
- **Status:** PROPOSED — awaiting owner approval (duration open).
- **Implementation consequence:** The 06 trigger keeps blocking all archival
  transitions. No delete policy or grant is added anywhere.

## P10-08 — Media upload remains deferred

- **Original question:** Approve artwork ownership/scope/moderation before any
  logo/banner column or upload surface. (Supersedes P9-09.)
- **Proposed recommendation:** DEFER. No logo/banner column, no upload
  component, no signed-URL flow, no authenticated storage policy for
  organizer or tournament artwork.
- **Security consequences:** Eliminates the entire unmoderated-image attack
  surface (malicious imagery, copyrighted material, storage abuse) at the cost
  of plainer cards.
- **Product consequences:** Initial-letter marks remain the visual identity;
  no stock imagery, no external hotlinks.
- **Status:** PROPOSED-DEFERRED — awaiting owner confirmation of the deferral.
- **Implementation consequence:** Nothing media-shaped is built. Evidence
  uploads are covered by the same deferral (no upload system until access and
  retention policy is approved).

## P10-09 — Organizer filtering must not silently change the frozen P3 projection

- **Original question:** Approve a `p_organizer_slug` filter (or equivalent)
  so profiles list tournaments precisely instead of via name query.
  (Supersedes P9-10.)
- **Proposed recommendation:** Approve in principle with a hard constraint:
  any organizer filter is additive inside the RPC body and MUST NOT alter the
  frozen 14-column `search_tournaments` / detail contract (column order,
  types, `verified: false`, published-only predicate).
- **Security consequences:** A scoped filter cannot leak unpublished rows as
  long as the `lifecycle = 'published'` predicate and the column contract are
  asserted by tests before and after the change.
- **Product consequences:** Profiles can link to precise tournament lists
  without a second query path.
- **Status:** PROPOSED — awaiting owner approval.
- **Implementation consequence:** No filter is added in P10. P10 pins the
  current contract with regression tests and documents the filter as a
  post-approval additive change (see `next-phase-recommendation.md`).

## Cross-cutting note

P10 invents no moderator authority and approves no verification. Every
"proposed" above is safe to leave undecided: the platform operates (reads,
workspaces, disabled shells) identically whether owners approve tomorrow or
never.
