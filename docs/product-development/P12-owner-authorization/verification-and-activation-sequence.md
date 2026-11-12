# Verification and activation sequence (10 stages, no skipping)

Each stage names its entry criteria, action, and exit evidence. A stage that
cannot produce its exit evidence blocks every later stage.

## 1. Owner approvals

- Entry: this package delivered, all decisions UNAPPROVED.
- Action: owners record approve/amend/reject per decision in
  `owner-approval-record.md` (minimum for any activation: D-04, D-06, D-11, D-12).
- Exit: signed record; partial approval supported (unapproved capabilities
  stay gated).

## 2. Migration static review

- Entry: signed record from stage 1.
- Action: independent re-review of all nine files (G1 → P9 → P11 → created
  §2–§4 file) against `clause-by-clause-security-review.md`; confirm the
  created file is verbatim from the approved proposal.
- Exit: review sign-off noting any deviation (deviation = return to P12).

## 3. Authorized runtime PostgreSQL/RLS verification

- Entry: D-06 replay authorization + stages 1–2 exit.
- Action: disposable replay in order with the isolated-identity pattern:
  trigger matrix (lifecycle + F-01 + F-02), RLS matrix per role, grant
  effectiveness through PostgREST roles, queue inertness-then-activation,
  `provision_organizer` happy-path + abuse paths (suspended owner, duplicate
  slug, non-admin caller, replayed call), F-02 edit matrix (20 fields ×
  published/unpublished), decision/case insert paths with forged-identity
  attempts.
- Exit: green matrix + logs. Red = fix in a new proposal phase, never patch
  the file in place.

## 4. Migration application authorization

- Entry: stage 3 exit.
- Action: explicit authorization naming the exact file hashes to apply, to
  which project, by whom, with rollback ready.
- Exit: written authorization (not inferred from stage 3).

## 5. Migration application

- Entry: stage 4 exit.
- Action: apply in filename order; verify object inventory after each file.
- Exit: applied-hash record matching stage 4 authorization.

## 6. Organizer bootstrap verification

- Entry: stage 5 exit.
- Action: provision one test organizer via `provision_organizer` as admin;
  confirm owner row, audit row, closed direct-insert paths (attempted
  inserts fail), duplicate-slug replay fails closed.
- Exit: bootstrap evidence log. (Test rows follow the tracked-id cleanup
  rule if the project policy requires it.)

## 7. Moderator authorization verification

- Entry: stage 6 exit.
- Action: confirm queue reads deny non-moderators, allow moderators;
  self-review assignment exclusion demonstrated operationally.
- Exit: authorization matrix log.

## 8. Draft persistence verification

- Entry: stages 6–7 exit.
- Action: member draft create/edit within the RLS + F-02 rules; published
  rows reject all 20 content edits; cross-organizer attempts fail.
- Exit: persistence evidence log.

## 9. Submission and review verification

- Entry: stage 8 exit.
- Action: draft → submitted → published (moderator) with decision audit;
  submitted → draft with reason; unpublish; archive; rejection-reason
  visibility to the organizer.
- Exit: end-to-end review evidence log.

## 10. Controlled write-switch enablement

- Entry: stages 8–9 exit, per capability.
- Action: flip exactly one switch (`ORGANIZER_` after 6+8;
  `TOURNAMENT_` after 8+9; `MODERATION_` after 7+9), updating the pinning
  tests in the same change.
- Exit: one-switch evidence bundle. Joint flips are forbidden.

## Stage-skipping rule

No stage may be declared complete by argument ("the code obviously works",
"the replay is unnecessary"). Stages 3–5 are blocked today by the missing
D-06 authorization and the standing environment constraints — that block is
the honest status, not a formality to waive.
