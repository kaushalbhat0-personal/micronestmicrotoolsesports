# 02 — F-02 reviewed-snapshot design

## Gap restated (P12 residual)

The P11 freeze fires only when OLD is `published`. A `submitted → published`
transition therefore had to prove, in the database, that the content being
published is the content that was reviewed — otherwise edits after review,
concurrent edits, or stale-approval replays bypass moderation intent.

## Solution (implemented in `20261113000004_p13_f02_snapshot.sql`, unapplied)

Submission versioning + content hashing + version-bound, hash-bound decisions:

1. **`tournaments.submission_version`** (new, default 0): bumped by the
   lifecycle trigger on every `draft → submitted`. The trigger overwrites any
   caller-supplied value, so members cannot forge versions. Additive column;
   P3 RPCs select explicit columns — projection unchanged.
2. **`tournament_content_hash()`** (immutable, empty search path, revoked
   from all API roles): sha256 over the 19 reviewed content fields.
   `published_at` is deliberately excluded — it is set at publish time by
   the moderator and frozen thereafter by the F-02 trigger (freeze-protected,
   not snapshot-hashed). Instants normalized via UTC `to_char` (never raw
   `::text`, which depends on TimeZone); NULLs via sentinel separators;
   jsonb via deterministic `::text`.
3. **Decision binding columns** (`moderation_decisions.content_hash`,
   `submission_version` + CHECK): mandatory (64-hex hash + version) for
   `publish`/`republish`, forbidden for all other decision types (reason-only
   audit stays clean).
4. **`tournament_review_approval_valid()`** (stable, DEFINER for RLS
   determinism, revoked from all — trigger-reachable only): at transition
   time requires decision type + version + (for publish/republish) hash
   match, reviewer currently super-admin with active account, and reviewer
   not a member of the target organizer.

## Adversarial coverage (each with test + DB mechanism)

| Attack | DB mechanism that defeats it |
| ------ | ---------------------------- |
| Edit submitted content before publish | Hash recomputed from NEW row; mismatch raises |
| Concurrent edit between decision and publish | Same — hash binds the exact bytes at transition time |
| Stale approval replay (resubmit after return) | Version bumped on resubmit; old decision version mismatches |
| Organizer approves own content | Decision insert requires live `is_super_admin()` + `reviewer_id = auth.uid()` |
| Admin+member overlap self-review | Validator's `not exists (organizer_members…)` clause |
| Inactive/suspended moderator | Validator re-checks `platform_admins` + active `app_users` at transition time |
| Reviewer identity spoofing | `reviewer_id` forced to session by policy; validator never reads caller input |
| Republish after unpublish with old approval | Decision-type exact match (`republish` ≠ `publish`) + version binding |
| Published content mutation | Unchanged P11 freeze (activation does not touch it) |
| Replay/rollback confusion | Additive-only files; per-file rollback notes; single function replacement with verbatim restore source (P9 file 06) |

## What the schema cannot do (honest boundary)

- It cannot prove the moderator *looked* at the content — only that the
  published bytes equal the decided bytes. Review quality remains procedural
  (governance + SLA).
- `jsonb` hash uses `::text` normalization (deterministic for equal values
  in PostgreSQL's jsonb output ordering); exotic key-order games do not
  survive jsonb normalization.
- Timezone normalization assumes `AT TIME ZONE 'UTC'` + `to_char` stability
  across PG 17 minor versions (format model is stable; replay verifies).
