# 04 — Security test matrix (P13-A)

Lane: unit/static only (`npm test` excludes `*.integration.test.ts`).
Runtime execution remains blocked — every row below is honest about its lane.

| # | Requirement | Test | Lane | Result |
| - | ----------- | ---- | ---- | ------ |
| 1 | D-01 independent model | P9/P10 organizer suites (registry, single owner) | unit | pass (unchanged) |
| 2 | D-04 authority/governance | p12 proposal gates, p13 validator re-check clauses | static | pass |
| 3 | D-07 return-to-draft + reason | Activation branch requires `return_to_draft` decision; reason NOT NULL in queue DDL | static | pass |
| 4 | D-08 archival, no delete | No DELETE policy/grant in 04/05; no `delete from`/`truncate`; retained history | static | pass |
| 5 | D-11 provisioning | provision_organizer clauses (authority, binding, duplicates, audit, atomicity) | static | pass |
| 6 | D-12 strict freeze (20 fields) | f02 suite: per-field freeze clauses + rationale coverage | static | pass |
| 7 | D-13 retention representation | Statuses/resolutions vocabulary; decisions indefinite (no purge in scope) | static | pass |
| 8 | D-14 one-switch discipline | All three switches OFF, triple-pinned | static | pass |
| 9 | Snapshot: submit-edit-before-publish | Hash over NEW row at transition; binding test (hash mismatch → false) | static+sim | pass |
| 10 | Snapshot: concurrent edit | Same mechanism (bytes-at-transition binding) | static+sim | pass |
| 11 | Snapshot: stale replay | Version bump on resubmit; binding test (version mismatch → false) | static+sim | pass |
| 12 | Snapshot: organizer self-approval | Policy (super-admin + self reviewer) + validator no-member clause + `isSelfApproval` | static+sim | pass |
| 13 | Snapshot: unauthorized moderator | `is_super_admin()` gates (policy + validator + trigger); count ≥ 4 in activation | static | pass |
| 14 | Snapshot: inactive moderator | Live re-check `platform_admins` + active `app_users` in validator | static | pass |
| 15 | Snapshot: reviewer spoofing | `reviewer_id = auth.uid()` forced; strict schemas reject `reviewerId`/`decidedBy` | static+sim | pass |
| 16 | Snapshot: republish freshness | Decision-type exact match; `republish` ≠ `publish` | static | pass |
| 17 | Snapshot: published mutation | F-02 freeze untouched by activation (asserted) | static | pass |
| 18 | Snapshot: replay/rollback | Rollback notes in both files; single replacement with verbatim restore | static | pass |
| 19 | RLS/grants/functions | No table grants; 6 gated policies; DEFINER scope reviewed; revokes on all new functions | static | pass |
| 20 | Cross-org isolation | Validator organizer scoping; update contracts omit `organizer_id`; RLS joins | static+sim | pass |
| 21 | Self-review/privilege escalation | No-member clause + `isSelfApproval` + forced reviewer identity | static+sim | pass |
| 22 | Audit rollback atomicity | Single-transaction provisioning (organizer + owner + audit or nothing) | static | pass |

Full battery (recorded 2026-11-12): `npm test` 97 files / 975 tests pass;
`typecheck`, `lint`, `build` pass; `test:e2e` 23 pass; G1–P12 regression
zero-diff on P3 contract and all prior switches.
