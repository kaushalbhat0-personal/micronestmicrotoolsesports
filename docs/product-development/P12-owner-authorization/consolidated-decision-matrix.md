# Consolidated decision matrix (P9 → P12)

Status key: **UNAPPROVED** (awaiting owner), **DEFERRED-P** (proposed
deferral, awaiting confirmation). Nothing below is approved. "P13 gate"
marks whether P13 implementation work requires this decision first.

## D-01 — Independent organizers as the accountable identity (P9-01/P10-01)

- **Exact question:** Confirm the independent-organizer registry
  (`organizers` + `organizer_members`) as the accountable identity for
  tournament publishing, including single-owner launch.
- **Recommended answer:** Approve.
- **Alternatives:** (a) Organization-anchored identity only — rejected
  (conflates org membership with publishing authority); (b) no registry,
  free-text organizer names — rejected (no accountability, no moderation
  target).
- **User/platform impact:** Solo organizers can launch with one owner row;
  teams grow via the future invitation workflow.
- **Security consequences:** Single-owner concentration risk, compensated by
  founding-owner immutability (P9 trigger) + F-03 admin-provisioned binding.
- **Database changes required:** None beyond applied P9 pair + P11 guards.
- **Features blocked:** Organizer creation, tournament drafts, everything
  downstream.
- **P13 gate: YES.**

## D-02 — Organization linkage consent model (P9-02/P10-02)

- **Exact question:** Approve the dual-consent linkage flow (org admin
  proposes, organizer owner accepts, no automatic rights either way).
- **Recommended answer:** Approve the model; build it after launch (linkage
  stays null until then).
- **Alternatives:** (a) Automatic linkage by name — rejected (confused
  deputy); (b) org admins inherit organizer rights — rejected (privilege
  escalation); (c) never link — viable fallback, loses org-operated
  tournament attribution.
- **User/platform impact:** Two-step onboarding for org-operated tournaments;
  no silent conversion either way.
- **Security consequences:** Kills the org-membership → publishing-authority
  path entirely.
- **Database changes required:** Future linkage column + consent workflow
  (not in P11/P12 scope).
- **Features blocked:** Organization-operated attribution only.
- **P13 gate: NO** (launch proceeds with null linkage).

## D-03 — Professional operator class (P9-03/P10-03)

- **Exact question:** Approve the `professional` verification bar, or remove
  the value.
- **Recommended answer:** Defer (vocabulary frozen, zero rows).
- **Alternatives:** Define the bar now (rejected — needs the evidence policy
  first); remove the value (rejected — churns filters/cards for no gain).
- **User/platform impact:** None at launch; filtering honestly returns zero rows.
- **Security consequences:** No badge, no elevated trust rendered anywhere.
- **Database changes required:** None.
- **Features blocked:** Professional tier only.
- **P13 gate: NO.**

## D-04 — Moderation authority, SLA, queue rules, takedown (P9-04/P10-04, governance in P12)

- **Exact question:** Name the reviewers, review SLA, queue
  retention/visibility rule, and takedown power.
- **Recommended answer:** Authority = `platform_admins` via
  `is_super_admin()` (active account required); SLA/retention/visibility per
  `retention-and-sla.md`; takedown = unpublish/archive decisions per the
  lifecycle table. See `moderator-governance.md` for eligibility,
  appointment/revocation, separation, self-review ban, audit.
- **Alternatives:** (a) Elected/community moderators — rejected for v1 (Sybil
  + accountability gap); (b) organizer self-moderation — rejected (conflict
  of interest); (c) no moderation (open publishing) — rejected (spam/scam
  surface with no recourse).
- **User/platform impact:** Nothing publishes without review; review is slow
  by design; capacity bottleneck is the known cost.
- **Security consequences:** Single accountable authority; fail-closed
  triggers keep blocking everyone until the activation migration lands.
- **Database changes required:** Activation migration §§3–5 (queue policies,
  lifecycle replacement, decision-insert path).
- **Features blocked:** Publish, return, republish, archive, queue reads.
- **P13 gate: YES.**

## D-05 — Verification policy (P9-05/P10-05)

- **Exact question:** Evidence types, handling, retention, approver roles,
  expiry for `trust_state` transitions.
- **Recommended answer:** Manual review against declared categories;
  moderators only; evidence in private storage under the approved retention
  rule; expiry via re-check; domain ownership never sufficient.
- **Alternatives:** (a) Automated/domain-ownership verification — rejected
  (forgeable, presented as legitimacy); (b) no verification — viable but
  leaves `confirmed` permanently unreachable (acceptable fallback).
- **User/platform impact:** `confirmed` stays rare and meaningful.
- **Security consequences:** F-01 trigger makes forgery impossible at the DB;
  reviewer capacity + PII handling are the costs.
- **Database changes required:** Activation migration §6 (case-insert path
  for owners/admins, moderator review policies).
- **Features blocked:** Verification submission, review, expiry.
- **P13 gate: YES** (for verification features; publication can proceed
  with D-04 alone — unverified listings go live as **unverified**).

## D-06 — Migration application + runtime replay authorization (P9-06/P12-05)

- **Exact question:** Authorize (a) a disposable replay of G1 → P9 → P11
  with the isolated-identity pattern, and (b) subsequent primary-project
  application of exactly the replay-verified files.
- **Recommended answer:** Approve replay first; application only after green
  replay + this decision recorded.
- **Alternatives:** Apply without replay — rejected (unverified RLS/trigger
  behavior on the primary project); never apply — freezes the platform at
  read-only forever.
- **User/platform impact:** None until applied; then unlocks the gated sequence.
- **Security consequences:** Replay is the only faithful RLS/grant/trigger
  evidence available; remote writes stay forbidden until then.
- **Database changes required:** None (process decision).
- **Features blocked:** Everything that writes.
- **P13 gate: YES.**

## D-07 — Rejection as return-to-draft with reason (P9-07/P10-06)

- **Exact question:** Confirm `submitted → draft` + reason in the decision
  audit (no stored `rejected` state).
- **Recommended answer:** Approve.
- **Alternatives:** Stored `rejected` state (rejected — enlarges the public
  enum, splits the audit trail).
- **Security consequences:** Reasons live in append-only moderator-written
  rows organizers cannot forge or edit.
- **Database changes required:** Activation migration §4 (decision-insert
  path) + P9 trigger relaxation for `submitted → draft` by moderators.
- **Features blocked:** Return-to-draft review action.
- **P13 gate: YES** (for review actions).

## D-08 — Archival retention duration (P9-08/P10-07)

- **Exact question:** Confirm no-delete posture + how long unpublished /
  archived rows persist.
- **Recommended answer:** No-delete posture approved; duration per
  `retention-and-sla.md` (archived tournaments indefinite; unpublished per
  rule). See D-13 for the full retention table.
- **Alternatives:** Hard delete on archive (rejected — destroys abuse
  evidence); fixed short purge (rejected without owner-set duration).
- **Security consequences:** Publish-then-vanish abuse stays evidenced.
- **Database changes required:** None (no delete path exists to remove).
- **Features blocked:** Archival action (also needs D-04).
- **P13 gate: YES** (for archive).

## D-09 — Media and evidence uploads (P9-09/P10-08)

- **Exact question:** Approve artwork/evidence ownership, scope, moderation,
  retention before any upload surface.
- **Recommended answer:** Deferred — no columns, no upload, no signed-URL flow.
- **Alternatives:** None viable without the policy.
- **User/platform impact:** Initial-letter marks remain; no evidence intake.
- **Security consequences:** Entire unmoderated-file surface stays closed.
- **Database changes required:** None (queue DDL has no evidence columns).
- **Features blocked:** Artwork, evidence uploads.
- **P13 gate: NO.**

## D-10 — Organizer directory filter (P9-10/P10-09)

- **Exact question:** Approve an additive `p_organizer_slug` filter preserving
  the frozen P3 contract.
- **Recommended answer:** Approve in principle; build post-launch.
- **Alternatives:** Name-query linking (rejected — imprecise); no filter
  (acceptable interim — profiles link to the directory).
- **Security consequences:** None while predicate + contract are test-pinned.
- **Database changes required:** Additive RPC-body change only (future file).
- **Features blocked:** Precise profile → tournament lists.
- **P13 gate: NO.**

## D-11 — F-03 provisioning power (P12-01, new)

- **Exact question:** Authorize platform admins to provision organizers +
  founding owner rows (bound to verified session identity, audited), per
  `f03-bootstrap-authorization.md`. No public self-claim, no caller-supplied
  owner identity.
- **Recommended answer:** Approve.
- **Alternatives:** Claim tokens (rejected for v1 — larger surface, replay
  machinery); open self-claim (rejected — squatting/impersonation).
- **User/platform impact:** Organizer onboarding is admin-mediated at launch
  (slow, accountable).
- **Security consequences:** No public ownership-minting path; provisioning
  confined to audited DEFINER function.
- **Database changes required:** Activation migration §2
  (`provision_organizer`, EXECUTE grant, audit insert, no table grants).
- **Features blocked:** Organizer creation (B-0/B-1).
- **P13 gate: YES.**

## D-12 — F-02 strict default (P12-02, new)

- **Exact question:** Adopt the strict default (all 20 content columns frozen
  while `published`; edit = unpublish → edit → resubmit → review), with any
  per-field relaxation requiring a future owner decision + migration edit.
- **Recommended answer:** Approve strict as default.
- **Alternatives:** Per-field safe list now (rejected — no evidence for any
  field being abuse-proof); code-only allowlist (rejected — database is the
  allowlist).
- **User/platform impact:** Typo fixes on live listings cost a resubmission
  cycle; bait-and-switch is structurally impossible.
- **Security consequences:** Published content equals reviewed content, always.
- **Database changes required:** None beyond P11 file 02 (already drafted).
- **Features blocked:** Publication (C-4).
- **P13 gate: YES** (resolved-by-default-strict: silence = strict stands).

## D-13 — Retention and SLA table (P12-04, new)

- **Exact question:** Adopt the retention durations and reviewer SLA in
  `retention-and-sla.md`.
- **Recommended answer:** Approve (durations are proposals; adjust line by
  line in `owner-approval-record.md`).
- **Alternatives:** Indefinite everything (rejected — unbounded PII); short
  purges (rejected — destroys audit).
- **Security consequences:** Bounded PII, permanent decision audit.
- **Database changes required:** Future purge job (not in activation scope).
- **Features blocked:** Queue operation at scale.
- **P13 gate: YES.**

## D-14 — Switch-flip discipline (P12-06, new process gate)

- **Exact question:** Confirm one-switch-at-a-time enablement per
  `verification-and-activation-sequence.md` with evidence per flip.
- **Recommended answer:** Approve.
- **Alternatives:** Joint flips (rejected — no independent evidence per
  capability).
- **Security consequences:** A bad capability cannot drag others with it.
- **Database changes required:** None (process).
- **Features blocked:** All enablement.
- **P13 gate: YES.**
