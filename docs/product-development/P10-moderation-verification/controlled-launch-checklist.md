# P10 controlled launch checklist

Enable **one capability at a time**, only after its gates pass. The two kill
switches flip independently and never together without independent evidence
for each. Nothing in P10 flips either switch.

## Stage A — Database readiness

- [ ] A-1 Migration replay: 05 → 06 execute cleanly in an authorized
  disposable replay; syntax, triggers, policies, grants verified at runtime.
- [ ] A-2 Trigger verification: lifecycle allow/deny matrix, immutability
  guards, no-identity-change guards all fire as specified under real JWTs.
- [ ] A-3 RLS matrix: anon/authenticated/member/moderator rows exercised per
  `security-and-authorization.md`, **including F-01** (`trust_state`
  column guard present) and cross-organizer denial.
- [ ] A-4 Grants: PostgREST role switching confirms least-privilege
  (Section `security-and-authorization.md` grant matrix).
- [ ] A-5 P3 reader compatibility: frozen 14-column contract byte-identical;
  `TOURNAMENT_DIRECTORY_COLUMNS` unchanged; P3 suites green against applied
  RPCs; `submitted`/`archived` never leak.

## Stage B — Organizer readiness

- [ ] B-0 Founding-owner insert path exists (F-03 fix: narrow self-insert
  policy + grant) — prerequisite to ANY organizer write.
- [ ] B-1 Registration/claim: active account creates exactly one organizer +
  founding owner row; duplicates rejected.
- [ ] B-2 Ownership controls: owner immutable, no transfer, no second owner.
- [ ] B-3 Profile editing: owner/admin only; slug/`created_by` frozen;
  `trust_state`/`is_public` unwritable by members (F-01 fix).
- [ ] B-4 Public reads: masked RPCs return exactly the 8-column contract.

## Stage C — Tournament readiness

- [ ] C-1 Draft persistence: member-scoped create/edit; `organizer_id`/
  `game_key`/`slug` frozen after creation.
- [ ] C-2 Submission: owner/admin/editor `draft → submitted` persists.
- [ ] C-3 Moderator review: `submitted → published` and
  `submitted → draft` (with reason) work for moderators only, blocked for
  all organizer roles, blocked for anonymous.
- [ ] C-4 Published-row edits: **F-02 resolved** (strict freeze or
  reviewed-diff rule enforced in SQL, not just copy).
- [ ] C-5 Unpublication: owner/admin/moderator path works; history preserved.
- [ ] C-6 Archival: moderator-only soft archival; rows preserved; no delete
  path exists for any role.

## Stage D — Public readiness

- [ ] D-1 Organizer directory + profiles render from masked RPCs only.
- [ ] D-2 Published tournaments render the frozen 14-column contract.
- [ ] D-3 Tournament detail links organizers honestly (null linkage until
  approved; no inferred organization).
- [ ] D-4 Trust states render honestly: only `confirmed` (post F-01 fix)
  shows an indicator; everything else shows `Unverified` + label + note;
  no listing implies endorsement.

## Switch discipline

1. `ORGANIZER_WRITES_ENABLED` flips only after A + B gates (with B-0).
2. `TOURNAMENT_WRITES_ENABLED` flips only after A + C gates (with C-4).
3. `MODERATION_WRITES_ENABLED` flips only after the moderation-authority +
   queue-table + retention approvals AND their own RLS replay.
4. Each flip updates its pinning test in the same change; a flip without
   evidence breaks the suite by design.
