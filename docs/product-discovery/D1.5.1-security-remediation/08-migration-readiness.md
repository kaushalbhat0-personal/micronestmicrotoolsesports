# 08 — Migration Readiness

## File order (local, unapplied)

1. `20261112000001_d1_admin_foundation.sql` — UNCHANGED (not edited in D1.5.1).
2. `20261112000002_d1_teams_discovery.sql` — UNCHANGED (not edited in D1.5.1).
3. `20261112000003_d1_security_remediation.sql` — NEW corrective migration.

Rationale (repo convention): G1 itself fixed a recorded migration additively
(`20261111000009` over `...000008`) rather than rewriting history. Since the D1
files were recorded but never applied, either approach would be mechanically
safe; the additive file is chosen so review history stays legible: original
defects remain visible in `000001/000002`, corrections in `000003`. No
duplicate/conflicting definitions: every replaced object uses `CREATE OR
REPLACE` on the same signature, every replaced policy is `DROP ... IF EXISTS`
then recreated, new triggers/functions use new names.

## Were originals changed?

No. Verified by worktree inspection: both files retain their recorded content;
only reads were performed on them in D1.5/D1.5.1.

## G1 non-regression (static proof)

`000003` contains no statement referencing `app_users` policies/grants (other
than the `is_super_admin` SELECT join, which bypasses RLS as DEFINER),
`player_profiles`, `player_game_profiles`, `games` writes, public-projection
RPCs, storage buckets/objects, or `handle_updated_at` replacement. Full suite
(335 tests incl. all G1 suites), typecheck, and lint pass.

## Fresh static re-review: READY

The corrected SQL text is ready for an independent static re-review now
(all six in-scope fixes assertable from the file).

## Replay gates REQUIRED before any apply (disposable DB only)

1. Member-captain `UPDATE teams` on each protected column → denied.
2. Captain `UPDATE teams` on allowed columns → permitted.
3. Applicant self-accept / `decided_*` / `post_id` / note writes → denied;
   `applied→withdrawn` → permitted; second withdraw → denied.
4. Suspended admin `is_super_admin()` → false; active → true; anon → false.
5. Suspended captain member/post writes → denied.
6. Direct `team_members` INSERT (self or arbitrary) → denied.
7. `search_teams('%')` / `'_'` / `'\'` → literal, bounded.
8. Anon base-table SELECT on all five tables → denied; RPC reads → permitted.
9. Audit UPDATE/DELETE as service-role DML → trigger rejection (document
   TRUNCATE as engine-governed).
10. Fresh-apply ordering 000001→000002→000003 on an empty disposable schema.

## Not authorized

Apply to `knniommcyyhbyiwljisk`, remote execution, `db reset`, durable seed
data, commits, pushes, deployments — none performed, none authorized by D1.5.1.
