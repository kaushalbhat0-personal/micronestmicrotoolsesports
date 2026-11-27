# 09 — PostgreSQL test plan for both P13 migrations (exact, unexecuted)

Status: PLAN ONLY. Every case below is specified against the real
PostgreSQL/RLS/PostgREST layers, but per §08 no faithful safe route exists
under P13-B constraints — so each case is labeled with its honest execution
layer TODAY (unit / static / simulated) and its REQUIRED layer for closure
(PostgreSQL / RLS / PostgREST). Nothing in this plan was executed as a write.

Target objects (post-application): `tournaments.submission_version`,
`tournament_content_hash()`, `moderation_decisions.content_hash` /
`submission_version` + CHECK, `tournament_review_approval_valid()`,
`provision_organizer()`, 6 queue policies, replaced
`enforce_tournament_lifecycle()`. Preconditions: G1 repaired, D1+P9+P11+P13
pushed in order (§10), switches still OFF.

Seed convention for the authorized window: dedicated test organizer(s)
`rt-*`, test users (reporter, owner, moderator-active, moderator-suspended,
non-admin), cleanup by archival + disclosure in evidence (audit rows
retained, never deleted). All cases assume `ORGANIZER/TOURNAMENT/MODERATION_WRITES_ENABLED = false` at the app layer — probes run at SQL/PostgREST, never via writers.

## A. F-02 reviewed-snapshot tests

| ID | Case | Steps (exact) | Expected | Layer today | Required layer |
| -- | ---- | ------------- | -------- | ----------- | -------------- |
| F-01 | Submit bumps version | draft→submitted as owner; read `submission_version` | old+1; caller-supplied value overwritten | static (`NEW.submission_version := OLD…+1` pinned) | PostgreSQL |
| F-02 | Hash determinism | `tournament_content_hash` twice over identical 19 fields; NULL↔value; tz-shifted instants | identical hex; 64 chars; NULL-safe; tz-stable | static+simulated | PostgreSQL |
| F-03 | All-20-field freeze coverage | per-field UPDATE on published row for each of the 20 `MATERIAL_TOURNAMENT_FIELDS` | each raises via P11 freeze (19) / freeze incl. `published_at` | static (f02-content-integrity pins) | PostgreSQL |
| F-04 | Edit-after-review blocked | submitted(v3)→decision(publish,v3,h3)→edit title→publish attempt | publish raises snapshot-mismatch | static+simulated | PostgreSQL (trigger) |
| F-05 | Concurrent edit blocked | decision(publish,v3,h3) recorded; concurrent session edits description; publish with h3 | raises (NEW-hash ≠ h3) | static+simulated | PostgreSQL (two sessions) |
| F-06 | Stale approval replay blocked | publish-decision(v3)→return_to_draft→resubmit(v4)→publish citing v3 decision | raises version-mismatch | static+simulated | PostgreSQL |
| F-07 | Replayed approval (same version, edited content) | v3 decision h3; edit fee; publish citing (v3,h3) | raises hash-mismatch | static+simulated | PostgreSQL |
| F-08 | Self-review blocked | owner who is also super-admin records publish decision, attempts publish | validator `not exists (organizer_members…)` fails → raise | static | PostgreSQL + RLS |
| F-09 | Reviewer spoofing unrepresentable | non-admin attempts decision INSERT with `reviewer_id` = moderator UUID | policy `reviewer_id = auth.uid()` denies | static | RLS + PostgREST |
| F-10 | Inactive reviewer blocked | decision by moderator → suspend moderator (`app_users.status`) → publish attempt | validator live re-check fails → raise | static | PostgreSQL |
| F-11 | Wrong-type decision rejected | publish transition citing `return_to_draft` decision (same version) | raises (type exact-match) | static+simulated | PostgreSQL |
| F-12 | Republish freshness | unpublish→edit→new `republish` decision required; old `publish` decision does NOT authorize republish | old decision raises; new one passes | static | PostgreSQL |
| F-13 | `published_at` control | attempt direct `published_at` write on published row; confirm publish path sets it and freeze pins it after | direct write raises; lifecycle set survives | static | PostgreSQL |
| F-14 | 19-vs-20 rationale | confirm `p_published_at` absent from hash args AND `published_at` present in freeze list | both hold (exclusion by design, freeze by trigger) | static (pinned) | PostgreSQL (code review + probe) |
| F-15 | Full cycle | draft→submit→review→publish→edit-blocked→unpublish→resubmit→review→republish | each gate behaves per matrix | static | PostgreSQL + RLS |

## B. Organizer provisioning (`provision_organizer`)

| ID | Case | Expected | Layer today | Required layer |
| -- | ---- | -------- | ----------- | -------------- |
| P-01 | Unauthenticated caller (`auth.uid()` NULL) | raises (`is_super_admin()` false) | static | RLS/PostgREST (anon RPC deny or in-body raise) |
| P-02 | Non-admin authenticated | raises moderator-authority | static | RLS/PostgREST |
| P-03 | Inactive admin (suspended) | raises (live status re-check via `is_super_admin`) | static | PostgreSQL |
| P-04 | Active super-admin, valid inputs | returns UUID; organizer + owner-member + audit row in one txn | static | PostgreSQL |
| P-05 | Caller-supplied owner is authority-escape attempt | owner pointer validated as active account; caller authority still gated on `is_super_admin()`; audit `actor = auth.uid()` ≠ owner possible | static | PostgreSQL |
| P-06 | Duplicate slug (case/space variants) | raises pre-check + unique constraint | static | PostgreSQL |
| P-07 | Invalid inputs (slug/name/class/game_keys/owner per CHECK mirrors) | each raises its message | static | PostgreSQL |
| P-08 | Audit-insert failure atomicity | fault audit insert → whole provisioning rolls back (no orphan organizer/member) | static (single-txn code read) | PostgreSQL (fault injection) |
| P-09 | Transaction rollback | error mid-function leaves zero rows across all three tables | static | PostgreSQL |
| P-10 | Founding-owner immutability | owner row `role='owner'` present; no RPC demotes/removes founder (no member-management RPC in scope) | static | PostgreSQL |

## C. Moderation + RLS

| ID | Case | Expected | Layer today | Required layer |
| -- | ---- | -------- | ----------- | -------------- |
| R-01 | Reporter insert (self, open, unattributed, active) | allowed | static | RLS/PostgREST |
| R-02 | Reporter insert forged (`reporter_id` ≠ self / preset status/reason/reviewer) | denied by WITH CHECK | static | RLS/PostgREST |
| R-03 | Reporter update/delete own report | denied (no policy) | static | RLS/PostgREST |
| R-04 | Organizer ownership boundary (tournament DML by non-member / cross-org member) | denied by P9 RLS (unchanged) | static | RLS/PostgREST |
| R-05 | Moderator report select/update | allowed iff `is_super_admin()` | static | RLS/PostgREST |
| R-06 | Moderator decision insert (self-reviewer, active) | allowed; forged reviewer denied | static | RLS/PostgREST |
| R-07 | Moderator self-review prohibition (member+admin overlap) | decision insert allowed (policy) but publish blocked (validator) — two-layer posture | static | PostgreSQL + RLS |
| R-08 | Conflict reassignment (decision by admin A, publish after A suspended, decision by B) | A-decision fails validator; B-decision passes | static | PostgreSQL |
| R-09 | Mandatory decision reason (return/archive without reason row) | transition raises recorded-decision | static | PostgreSQL |
| R-10 | Append-only decision history (update/delete decision row) | denied (no policy) | static | RLS/PostgREST |
| R-11 | Cross-organizer isolation (member of org X reads decisions of org Y) | denied by member-select join scoping | static | RLS/PostgREST |
| R-12 | Anonymous access (all tables + RPCs except approved public G1 RPCs) | denied; no anon policy in 04/05 | static | PostgREST |
| R-13 | Direct table access bypass (PostgREST PATCH of `submission_version`, `reviewer_id`, `content_hash`) | version overwritten by trigger / reviewer forced / hash bound by CHECK+validator | static | RLS/PostgREST |
| R-14 | Unauthorized RPC execution (`provision_organizer` as anon; validator/hash direct EXECUTE) | anon denied by grant; validator/hash revoked from all API roles | static (revokes pinned) | PostgREST |
| R-15 | Inactive account (suspended reporter/owner/moderator) | inserts denied; transitions raise | static | RLS + PostgreSQL |

## D. Lifecycle

| ID | Case | Expected | Layer today | Required layer |
| -- | ---- | -------- | ----------- | -------------- |
| L-01 | Draft submit (owner) | version bump, no decision needed | static | PostgreSQL |
| L-02 | Submission review (return_to_draft + reason) | requires live authority + reason decision | static | PostgreSQL |
| L-03 | Approval + publication (hash+version bound) | requires live authority + exact decision | static | PostgreSQL |
| L-04 | Rejection to draft with reason | `return_to_draft` decision mandatory; lifecycle returns | static | PostgreSQL |
| L-05 | Unpublish (organizer-reachable, P9-exact) | no decision required; membership via RLS | static (branch pinned) | PostgreSQL + RLS |
| L-06 | Republish authorization | `republish` decision + fresh hash required | static | PostgreSQL |
| L-07 | Archive (from unpublished/published per validator) | `archive` decision + authority required; no delete anywhere | static | PostgreSQL |
| L-08 | Published content mutation | P11 freeze raises (all 20 fields) | static | PostgreSQL |
| L-09 | Strict F-02 integrity end-to-end | F-04…F-12 chain on one listing | all gates hold | PostgreSQL + RLS |

## E. Coverage vs gaps (honest)

- Covered today (static/simulated, green): every row's SQL-text mechanism
  (F-01…F-15, P-01…P-10, R-01…R-15, L-01…L-09 mechanism pins).
- NOT covered today: live enforcement (trigger firing order, RLS allow/deny
  per role, PostgREST status codes, two-session concurrency, fault-injection
  atomicity, JWT identity binding). These require the authorized window
  (§08.5, §10) and are the exact remaining runtime gap.
- D-05 verification cases, D-02 linkage, D-09 media: excluded by deferral —
  no test fabricates them; `verification_cases` stays policy-less and inert.
