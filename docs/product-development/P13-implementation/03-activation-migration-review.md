# 03 — Activation migration review (04 + 05, clause level)

## `20261113000004_p13_f02_snapshot.sql` (support, no behavior change)

- 1 ALTER (version column, default 0), 2 functions (hash immutable,
  validator stable DEFINER), 2 columns + 1 CHECK on decisions, 8 revokes.
- Modifies no existing object; grants nothing; policies none. Safe to apply
  before or with file 05; order 04 → 05 fixed by the validator reference.

## `20261113000005_p13_activation.sql` (approved scope: D-04/D-07/D-08/D-11/D-12)

- **§2 provision_organizer:** in-body `is_super_admin()` first; validated
  inputs mirroring P9 CHECKs; active-account owner pointer; duplicate-slug
  pre-check + unique constraint; single-transaction organizer + owner +
  audit rows; EXECUTE to authenticated only (grant is not authority).
- **§3 policies (6):** reporter insert (self, open, unattributed, active);
  moderator select/update on reports; moderator insert (self-reviewer) /
  select on decisions; member select on own organizer's decisions. No anon
  policy, no DELETE policy, no `organizer_members` policy, no
  `verification_cases` policy (D-05 deferred — table stays inert).
- **§4 lifecycle replacement:** P9 behavior byte-identical for all
  non-privileged paths (same messages, same fall-through); `draft →
  submitted` bumps version; all four moderator transitions require live
  authority + version-bound decision (+ hash for publish/republish);
  `published → unpublished` restored to exact P9 behavior (no decision
  required — row membership enforced by RLS). Rollback = re-apply P9 file-06
  body verbatim.
- **§5 exclusions honored:** no table grants, no evidence/media/linkage,
  no P3 changes, no F-02 weakening (freeze trigger untouched, hash excludes
  only `published_at` by documented design).

## Ordering and dependencies

G1 (live) → D1 01–04 → P9 05–06 → P11 01–03 → 04 → 05. Each file's objects
exist when referenced (`is_super_admin` from D1-03, queue tables from
P11-03, validator/hash from 04). No forward references, no cycles.

## P3 compatibility

No reader function recreated or altered; `submission_version` is not in any
projection; `TOURNAMENT_DIRECTORY_COLUMNS` untouched (zero diff, suites green).
