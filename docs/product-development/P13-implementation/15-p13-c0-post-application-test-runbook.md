# 15 — P13-C0 post-application test runbook (PLAN ONLY — separate approval required)

Executes only inside an authorized write window AFTER the doc-14 push, with
dedicated test identities and cleanup. Nothing below was executed in this
phase. All probes run at SQL/PostgREST with the app writers still OFF —
`ORGANIZER/TOURNAMENT/MODERATION_WRITES_ENABLED = false` throughout, so no
app-layer path can persist anything; every write here is an explicit,
logged test probe, never application traffic.

Source: the existing P13 test plan (`09-postgres-test-plan.md`: F-01…F-15,
P-01…P-10, R-01…R-15, L-01…L-09). This runbook groups those 49 cases into
the 12 coverage areas required for the owner decision. Case IDs map 1:1 to
§09 — no case added, none dropped.

## 0. Preconditions and identities

- Preconditions: doc-14 §6 green (ledger fully matched, inventory present,
  suites green, advisors reviewed, switches OFF).
- Test identities (auth users created in the window, prefixed `rt-`, with
  `app_users` rows): `rt_reporter` (active), `rt_owner` (active, no admin),
  `rt_mod_a` (active super-admin via `platform_admins`), `rt_mod_b`
  (active super-admin), `rt_suspended` (super-admin then suspended
  mid-battery), `rt_outsider` (active, member of nothing),
  `rt_org_b_owner` (second organization for isolation probes). Plus anon
  (no session) probes. No real user record may be used, touched, or
  created — every identity above is synthetic and prefixed for discovery.
- Test fixtures: organizer(s) `rt-*`, tournaments cycled through the
  lifecycle, reports/decisions referencing only test rows.
- Cleanup (safe): test organizers/tournaments/reports/decisions archived or
  left inert with `rt-` naming disclosed in the evidence log; audit rows
  (`admin_audit_logs`, decision history) RETAINED as evidence, never
  deleted (append-only + no-DELETE posture). Auth test users disabled/
  removed per the window's user-cleanup note. `bgmi` seed must read
  identical before and after. Cleanup verified by row counts + the
  pre/post inventory diff.

## 1. RLS isolation (R-04, R-11)

Cross-organization boundary: member of org X reads/attempts DML on org Y
tournaments and org Y `moderation_decisions` (member-select scoping) —
all denied. Non-member tournament DML denied by unchanged P9 RLS.
Pass = deny everywhere probed, allow only inside own org.

## 2. Anonymous versus authenticated access (R-12, R-14, P-01-part)

Anon: every table denied except the approved public G1 RPC pair; all P13
queue tables denied; `provision_organizer`, hash, and validator RPCs denied
(revoked from all API roles). Authenticated non-privileged: reached only via
the 6 approved policies. Pass = PostgREST status codes show deny by default.

## 3. Active-user requirements (R-15, P-03, F-10)

Suspended reporter/owner/moderator: inserts denied, transitions raise via
the live `app_users.status` re-checks (`is_super_admin` fail-closed,
validator suspension check F-10). Suspend `rt_mod_a` between recording a
decision and publish (R-08): old decision fails, `rt_mod_b` decision
passes. Pass = suspension enforced at both policy and trigger layers.

## 4. Organizer provisioning (P-01…P-10)

Unauthenticated NULL `auth.uid()` / non-admin / inactive admin → raise
(P-01…P-03). Active super-admin with valid inputs → returns UUID; organizer
+ owner-member + audit row in one transaction (P-04). Caller-supplied owner
validated as active account while authority stays on `auth.uid()` (P-05).
Duplicate slug (case/space variants) → pre-check + unique violation
(P-06). Invalid inputs per CHECK mirrors → exact messages (P-07). Audit
fault → full rollback, no orphan rows (P-08/P-09). Founding owner row
immutable (P-10). Pass = all ten hold; audit row retained.

## 5. Moderator authority (R-05, R-06, L-02, L-03)

Moderator report select/update and decision insert gated on live
`is_super_admin()` (R-05/R-06); forged `reviewer_id` denied by WITH CHECK
(R-06). Review-gated transitions (`return_to_draft` + reason L-02,
approval + publication L-03) require live authority + exact decision.
Pass = no moderator action possible without current authority.

## 6. Self-review prevention (F-08, R-07)

Owner who is also super-admin records a publish decision, attempts publish:
validator `not exists (organizer_members …)` clause raises (F-08).
Decision INSERT by a member+admin overlap is policy-allowed but the publish
is validator-blocked — the two-layer posture holds (R-07). Pass = both
layers observed, not just one.

## 7. Submission version increments (F-01, L-01, L-04)

Draft→submit bumps `submission_version` (caller-supplied value overwritten:
`NEW… := OLD…+1`); rejection returns to draft with mandatory reason
decision; each submit re-bumps. Pass = monotonic bump on every submit,
overwrite of client values.

## 8. Snapshot/hash matching (F-02, F-04…F-07, F-11, F-14, L-09)

Hash determinism over the 19 bound fields (NULL-safe, tz-stable), edit-after-
review blocked, concurrent-edit blocked (two sessions), stale-replay and
same-version-edited-content replays blocked, wrong-type decision rejected,
19-vs-20 rationale confirmed (`p_published_at` in hash args absent AND
`published_at` in freeze list present). Full strict-integrity chain on one
listing (L-09). Pass = every gate raises exactly as specified.

## 9. Published-content immutability (F-03, F-13, L-08)

Per-field UPDATE on a published row for each of the 20 material fields
raises via the P11 freeze trigger; direct `published_at` write raises while
the lifecycle publish path sets it. Pass = all 20 fields frozen, publish
path intact.

## 10. Rejection and resubmission (L-04, F-06, F-12)

Rejection mandates a `return_to_draft` decision with reason; resubmit bumps
version; citing the pre-rejection publish decision fails version-mismatch;
republish requires a NEW `republish` decision (old `publish` does not
authorize it). Pass = full reject→resubmit→republish cycle gated.

## 11. Unpublish and republish lifecycle (L-05, L-06, F-12)

Unpublish reachable by the organizer with no decision required (P9-exact
branch preserved); republish requires a fresh `republish` decision + fresh
hash. Archive from unpublished/published requires `archive` decision +
authority (L-07 covered here as the terminal branch). Pass = branches match
the matrix exactly.

## 12. No unauthorized deletion (D-08 retention posture)

Attempt DELETE on `tournaments`, queue tables, decision history, audit log:
all denied (no DELETE policy anywhere; append-only guard; audit no-mutation
triggers). No hard delete exists in any window path. Pass = deny on every
DELETE probe; retention posture observed live.

## Evidence log requirements

For each of the 49 cases: exact steps run, role/session used, expected vs
observed (PostgreSQL error message / PostgREST status code), and the layer
that enforced it. Pre/post row counts for all touched tables. Switches
re-verified OFF at start and end. Any deviation: stop the battery, record,
report — do not reinterpret a failure as a pass.
