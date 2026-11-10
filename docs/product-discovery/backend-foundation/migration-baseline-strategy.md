# Migration Baseline Strategy **[Proposed]**

## Facts established

- Live history holds 11/58 versions; live objects match repo definitions in all spot checks.
- Historical migrations contain **non-schema side effects**: seed INSERTs (`tools`, `plans`, `storage.buckets`), data backfills (`webhook_events` platform/external_event_id UPDATEs), destructive cleanup (DELETEs in `20251102000001_cleanup_unreleased_tools`), entitlement grants, and `handle_new_organization` auto-provisioning behavior that changed mid-history.
- Some migrations depend on earlier data/seed state (plans reference tool rows; cleanup deletes seeded rows; billing RPC evolutions assume prior versions).
- Duplicate version `20251005000001` exists (two files); live history records one name. Supabase CLI keys history by version — the collision makes naive `db push`/replay ambiguous.
- The history table therefore **cannot reliably distinguish applied migrations**: presence of objects ≠ application of a specific file.

## Approaches evaluated

**A. Preserve history + forward-only baseline marker.** New migrations only, starting with a no-op baseline marker documenting the audited live state. **[Proposed: recommended.]**
- Safety: nothing historical re-runs against production; zero live risk.
- Reproducibility: fresh envs replay 58 files — unverified until a staging reset test passes; duplicate version must be resolved first (rename one file with a new version + compatibility note, never rewrite history content).
- Ordering: new files use versions after the max existing prefix; collision avoided.
- Auditability: marker migration cites the parity audit (11/58 + verification method).
- Rollback: standard per-migration down discipline (new tables drop cleanly; role-widening is additive).
- CLI compatibility: fully compatible; no repair commands needed.
- Risk: low. **Residual risk:** fresh-env replay may diverge from live (untested); mitigated by staging reset test before any production push.

**B. Reconstruct missing history.** Mark-or-replay 47 files after per-file verification.
- Safety: poor — replaying seed/grant/cleanup files against production data risks duplicate grants, resurrected rows, or destructive DELETEs. Marking applied-without-verifying assumes what the audit explicitly refused to assume.
- Rejected as unsafe. Verification of 47 files' effects against live data is more work than the value, and history would still lie about *how* live got here.

**C. Separate clean lineage for future environments.** Keep live as-is; new envs start from a squashed baseline.
- Safety: live untouched. Reproducibility: excellent for new envs.
- Fatal flaw: lineage fork — live and fresh envs would have different histories forever, making every future `db push`/diff untrustworthy. Rejected.

**D. Baseline marker + staging replay proof (refinement of A).** Same as A, plus a mandatory staging-reset test that replays all 58 (+ fix for the duplicate version) and diffs against live catalog before any production migration.
- This is the recommended form of A: A for production safety, D's proof step for reproducibility confidence.

## Recommendation

**Approach A refined by D: forward-only baseline marker, no history reconstruction, staging replay proof before first production push.** Do not mark migrations applied by assumption; do not repair history; resolve the duplicate version by renaming one file to a new unique version in a normal forward migration step (with a comment, preserving both contents). First production migration is the marker + new domain tables per `implementation-sequence.md`. Nothing executed in this phase.
