# 10 — F-02 snapshot security review (P13-B, static + simulated only, 2026-11-12)

Scope: `20261113000004_p13_f02_snapshot.sql` (support, no behavior change alone)
as enforced by `20261113000005_p13_activation.sql` §4. No runtime execution is
claimed — every row below is static SQL-text evidence and/or simulated binding
logic, with the required live layer named. Live per-field UPDATE probes,
two-session concurrency, fault injection, and per-role PostgREST probes all
await the authorized post-push battery.

## 1. Frozen-content field matrix (20 fields: 19 hash-bound + `published_at` freeze-bound)

`MATERIAL_TOURNAMENT_FIELDS` (`src/features/moderation/domain/material-fields.ts`,
rationale each, pinned by `f02-content-integrity.test.ts`) vs database
protection:

| # | Field | Hash arg? | Freeze clause? | Migration definition | Test pin | Live probe still required |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `title` | ✅ `p_title` | ✅ P11-02 | `concat_ws` slot 1; `NEW.title is distinct from OLD.title` | `p13-snapshot` + `f02` per-field loop | UPDATE published row → must raise; publish-after-edit → snapshot-mismatch |
| 2 | `game_key` | ✅ | ✅ | slot 2; freeze line present | same | same |
| 3 | `region_code` | ✅ | ✅ | slot 3; freeze line present | same | same |
| 4 | `format` | ✅ | ✅ | slot 4; freeze line present | same | same |
| 5 | `starts_at` | ✅ UTC `to_char` | ✅ | slot 5 `at time zone 'UTC'`; freeze line present | `at time zone 'UTC'` pinned | tz-shifted instants → identical hex |
| 6 | `ends_at` | ✅ UTC | ✅ | slot 6; freeze line present | same | same |
| 7 | `timezone` | ✅ | ✅ | slot 7; freeze line present | same | same |
| 8 | `entry_fee_minor` | ✅ `::text` | ✅ | slot 8; freeze line present | same | NULL↔value determinism |
| 9 | `prize_pool_minor` | ✅ `::text` | ✅ | slot 9; freeze line present | same | same |
| 10 | `currency` | ✅ | ✅ | slot 10; freeze line present | same | same |
| 11 | `description` | ✅ | ✅ | slot 11; freeze line present | same | same |
| 12 | `organizer_kind` | ✅ | ✅ | slot 12; freeze line present | same | same |
| 13 | `organizer_name` | ✅ | ✅ | slot 13; freeze line present | same | same |
| 14 | `organizer_slug` | ✅ | ✅ | slot 14; freeze line present | same | same |
| 15 | `organizer_id` | ✅ `::text` | ✅ | slot 15; freeze line present | same | cross-org move → mismatch + isolation |
| 16 | `registration_url` | ✅ | ✅ | slot 16; freeze line present | same | same |
| 17 | `contact_instructions` | ✅ | ✅ | slot 17; freeze line present | same | scam-URL edit → mismatch |
| 18 | `registration_closes_at` | ✅ UTC | ✅ | slot 18; freeze line present | same | same |
| 19 | `eligibility` | ✅ `::text` (jsonb) | ✅ | slot 19 `p_eligibility::text`; freeze line present | `::text` present | key-order games → same hex (jsonb normalization) |
| 20 | `published_at` | ❌ EXCLUDED by design | ✅ | absent from hash args (`not contain p_published_at` pinned); `NEW.published_at is distinct from OLD.published_at` in P11-02; `p13-adversarial` asserts freeze untouched by activation | `p13-snapshot` exclusion + `p13-adversarial` freeze-untouched | direct `published_at` write → must raise; publish path sets it, freeze pins it after |

Rationale for 19-vs-20 (pinned in code + header + tests): `published_at` is set
at publish time by the moderator and frozen thereafter by the P11 trigger, so it
is integrity-protected by freeze, not by snapshot. Including it in the hash
would bind the decision to a value unknowable at review time.

## 2. `submission_version` behavior

- Column: `tournaments.submission_version int not null default 0` (`ADD COLUMN
  IF NOT EXISTS`). No backfill needed (table empty remotely; default covers any
  pre-existing row in a replay scenario).
- Bump: activation lifecycle `draft→submitted` executes
  `NEW.submission_version := OLD.submission_version + 1` — overwrites any
  caller-supplied value, so members cannot forge versions (static pin
  `p13-snapshot`).
- Binding: validator requires `d.submission_version = p_version`; resubmission
  after `return_to_draft` bumps the version, so stale approvals are
  unrepresentable (simulated: stale-replay rejection).
- No P3/G1 projection change: `submission_version` appears in no RPC column
  list; `TOURNAMENT_DIRECTORY_COLUMNS` untouched.

## 3. Hash normalization and null handling

- Algorithm: `extensions.digest(concat_ws(...), 'sha256')` → 64-char hex
  (`char_length(content_hash) = 64` in CHECK).
- Determinism: `immutable`, `search_path = ''`, revoked from all API roles
  (trigger-reachable only via the lifecycle function, which has no grant to
  anon and EXECUTE-to-authenticated only for `provision_organizer` — the hash
  fn itself grants nothing).
- Instants: UTC `to_char(…, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` — never raw
  `::text` (TimeZone-dependent). tz-shifted equivalents must hash identically
  (live probe open).
- NULLs: `\x1E` sentinel per slot; slots joined with `\x1F` — no ambiguous
  concatenation (static pins for both sentinels).
- `jsonb` (`eligibility`): `::text` normalization (deterministic for equal
  values under PostgreSQL jsonb output ordering; exotic key-order games do not
  survive jsonb normalization — documented honest boundary).
- `organizer_id` (uuid): `::text`; numerics via `::text`.

## 4. Snapshot creation and review binding

- Decision columns: `moderation_decisions.content_hash text null`,
  `submission_version int null` + CHECK
  `moderation_decisions_snapshot_binding_check`: `publish`/`republish` REQUIRE
  64-hex hash + version; ALL other decision types FORBID both (reason-only audit
  stays clean). Static pins: CHECK name + 64-length.
- Validator `tournament_review_approval_valid(tournament, decision, version,
  hash, organizer)`: `stable`, `SECURITY DEFINER` (deterministic regardless of
  caller RLS visibility), `search_path = ''`, revoked from public/anon/
  authenticated. Requires exact decision-type match + version match + (for
  publish/republish) hash match + reviewer row live (`platform_admins` JOIN
  active `app_users`) + reviewer NOT a member of the target organizer.
- Activation enforcement: `submitted→published` requires validator
  `(NEW.id, 'publish', NEW.submission_version, v_hash, NEW.organizer_id)` where
  `v_hash` is recomputed from the NEW row at transition time (TOCTOU closed:
  edit-after-review and concurrent-edit both mismatch); `unpublished→published`
  same with `'republish'`; `submitted→draft` and `→archived` require validator
  with their exact decision types (hash-independent, reason-mandatory); P9
  behavior byte-identical for all non-privileged paths.

## 5. Reviewer identity and self-review rejection

- Intake: decision-insert policy forces `reviewer_id = auth.uid()` +
  `is_super_admin()` + active account — forged reviewer identity is
  unrepresentable at the policy layer (static pins; strict schemas reject
  `reviewerId`/`decidedBy` at the app boundary — simulated spoof test).
- Transition: validator never reads caller input for reviewer identity — it
  checks the stored `d.reviewer_id` against live admin/active state, so
  suspension between decision and publish fails the transition.
- Self-review: validator `not exists (organizer_members … reviewer …)`
  rejects admin+member overlap even when the decision row itself passed the
  policy gate (two-layer posture: policy allows the insert, validator blocks the
  publish — deliberate, documented). Simulated `isSelfApproval` + static
  `organizer_members` clause pins.

## 6. Rejection, resubmission, and unpublish paths

- Rejection = `return_to_draft` with mandatory reason row (D-07); lifecycle
  requires the matching decision + authority.
- Resubmission bumps `submission_version` → old decisions mismatch on version
  (stale-approval replay blocked) AND on hash if content changed.
- `published→unpublished` restored to exact P9 behavior: no decision required
  (row membership enforced by RLS) — static branch pin (no validator call).
- `unpublished→published` requires a FRESH `republish` decision: old `publish`
  decisions fail on decision-type exact match (`d.decision = p_decision`) +
  version/hash binding.
- `→archived` (from unpublished per vocabulary; validator also authorizes from
  published per D-08) requires `archive` decision + authority; no DELETE exists
  anywhere (D-08 archival, no hard delete).

## 7. Content edits after approval; published→unpublished→edit→republish

- Same-state edits while `submitted` are permitted by the lifecycle trigger but
  change the NEW-row hash → publish attempt with the old decision hash raises
  snapshot-mismatch (static + simulated: hash-mismatch and concurrent-edit
  divergence rejections).
- Published content mutation stays blocked by the untouched P11 freeze (all 20
  fields; activation asserts `not contain freeze_published_tournament_content`).
  The only legal edit path is unpublish → edit as `unpublished` → resubmit
  (version bump) → fresh review → republish.

## 8. Trigger ordering and bypass resistance

- Ordering: `trg_tournaments_freeze_published` sorts before
  `trg_tournaments_lifecycle` alphabetically at the same BEFORE UPDATE level;
  concerns disjoint (content vs transitions) — order cannot affect correctness.
- Bypass resistance: triggers `SECURITY INVOKER` + `search_path = ''` +
  revokes; validator DEFINER revoked from all API roles (reachable only from
  triggers); hash fn likewise revoked; RLS default-deny on both tables; no
  table grants in either P13 file; no anon/DELETE/`organizer_members`/
  `verification_cases` policy; `provision_organizer` EXECUTE-to-authenticated
  is authority-gated in-body. Direct PostgREST PATCH of `submission_version`
  is overwritten by the trigger; of `reviewer_id`/`content_hash` is constrained
  by CHECK + validator recomputation from the NEW row.
- What the schema cannot do (honest boundary, carried from P13-A): it proves
  the published bytes equal the decided bytes — not that the moderator *looked*
  at the content. Review quality stays procedural (governance + SLA).

Findings: no F-02 design defect found at the static/simulated layer. All ten
adversarial cases are defeated by named database mechanisms; the two honest
boundaries above are documented, not hidden. Live enforcement remains the open
gap (post-push battery only) — no hash-design acceptance beyond static +
simulated evidence is claimed here.
