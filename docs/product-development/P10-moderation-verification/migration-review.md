# P10 migration review (static — both P9 migrations in application order)

Method: full read of `20261112000005_p9_organizer_foundation.sql` (05) and
`20261112000006_p9_tournament_link.sql` (06) against each other and against
the G1–P8 baseline (`01` baseline, `03` identity anchor, `06` game
catalogue, D1 admin foundation, D1 security remediation). No database was
touched; nothing was executed. Severity scale: **F** = load-bearing finding
(must be resolved before the gated capability enables), **N** = nit
(hardening, non-blocking).

## Application order and replay posture

- Filenames order 05 → 06; 06 depends on 05 (tournaments table, organizer
  RPCs) and both depend on G1 (`app_users`, `games`, `extensions`,
  `handle_updated_at`). Order is correct.
- 05 creates `tournaments` with RLS enabled and **all roles revoked before**
  06 adds policies and grants — there is no migration state in which the
  table is readable. Safe direction (deny) throughout the window.
- Both files are marked LOCAL PROPOSAL ONLY and remain unapplied. G1–P8
  migrations are untouched (byte-identical).

## Syntax and object review (05)

- Tables `organizers`, `organizer_members`, `tournaments`: all `CREATE TABLE`
  statements are well-formed; PK/FK/UNIQUE/CHECK shapes parse as written.
  FK targets exist in the baseline order (`app_users(id)` from G1 anchor,
  `games(key)` from game catalogue, `extensions.gen_random_uuid()` from the
  `pgcrypto`-with-`extensions` baseline).
- Regex CHECKs (`slug`, `website_url`, `region` shapes) use valid POSIX
  classes under `~`. `currency char(3)` with `^[A-Z]{3}$` is consistent.
- Indexes: GIN on `game_keys`, btree on region/type/lifecycle/organizer/user.
  The `published_tournament_count` subquery filters
  `tournaments(organizer_id, lifecycle)` — covered by the two single-column
  indexes; a composite `(organizer_id, lifecycle)` index is a future tuning
  option, not a correctness issue (**N-04** below).
- `handle_updated_at` triggers on both tables reference the baseline
  function that exists (01). Trigger firing order vs the P9 guard triggers is
  order-independent (disjoint concerns) — Table 1 in `tournament-moderation.md`.

## Syntax and object review (06)

- `enforce_tournament_lifecycle()` covers INSERT (must be `draft`) and every
  UPDATE pair: same-state pass-through, `draft → submitted` and
  `published → unpublished` allowed, all moderator-reserved transitions raise
  with an authority message, everything else raises. `draft → published` has
  no path (falls to the final raise). Correct as specified.
- RLS policies (3, all `to authenticated`, none to anon) join
  `organizer_members` on the row's own `organizer_id` — the cross-organizer
  isolation boundary is correctly expressed. Active-account gate
  (`app_users.status = 'active'`) is present on all six policy clauses.
- Grants: authenticated gets `select/insert/update` on tournaments,
  `select/insert/update` on organizers, `select` on members; anon gets
  nothing on base tables; both RPC pairs are revoked-from-public then granted
  to `anon, authenticated`. Least-privilege as specified.
- SECURITY DEFINER RPCs all carry `set search_path = ''` with
  schema-qualified references (`public.organizers`, `public.tournaments`,
  `public.escape_organizer_like`). `is_super_admin()` is **not** referenced
  anywhere — no moderator backdoor exists at the SQL layer.
- `search_tournaments` / `get_tournament_by_slug` return the frozen 14-column
  contract in order with the documented additive organizer-ref behavior,
  `verified: false`, and the `lifecycle = 'published'` predicate. No
  `submitted`/`archived` value can leak through the projection.

## Findings

### F-01 — `trust_state` is not column-protected (verification self-write at the SQL layer)

The `organizers admin update` policy plus the table-level `UPDATE` grant
permit any owner/admin row-holder to write **any** column, including
`trust_state` and `is_public`. The application boundary allowlists columns,
but any caller with a session JWT and direct PostgREST access can set their
own `trust_state = 'confirmed'`.

- Why load-bearing: P9/P10 verification separation is currently enforced
  only above the database. A public "confirmed" indicator read from this
  column would be forgeable by the organizer.
- Required fix (in the verification-approval migration, NOT in P10): either a
  `BEFORE UPDATE` trigger that raises when `trust_state` (or `is_public`)
  changes unless the actor is a moderator, or narrowing to column-level
  `UPDATE` grants. P10 documents the intended trigger shape in
  `organizer-verification.md` §8 but does not apply it.
- P10 posture: honest presentation (the UI never renders `confirmed` as
  authoritative until this is fixed) + code-level `canTouchVerification() =
  false` for all roles + tests pinning the gate.

### F-02 — Same-state updates to `published` rows need no re-review

The lifecycle trigger passes through every same-state update, and the RLS
update policy covers all members. A member can therefore edit a live
listing's prize, dates, fee, or registration URL without any re-review step.
The P9 lifecycle table only governs *transitions*, not *field edits within a
published state*.

- Why load-bearing: bait-and-switch listings (attractive draft → reviewed →
  edited after publish) bypass moderation intent while staying technically
  "published".
- Required fix (moderation-approval migration or launch gate): one of (a)
  freeze all non-ownership field edits on `published` rows at the trigger
  (any edit forces `published → unpublished` + resubmission), or (b) an
  explicit reviewed-field diff + re-review rule. P10 documents the options in
  `tournament-moderation.md` §7 and defaults new code to the strict reading.
- P10 posture: surfaced as a launch blocker (Stage C gate C-4); nothing
  publishes until it is resolved.

### F-03 — Founding-owner insert path does not exist yet

`organizer_members` has **no** INSERT policy and no INSERT grant ("invitation
workflow pending"). Flipping `ORGANIZER_WRITES_ENABLED` alone can therefore
never create the founding owner row — the gated writer would fail closed at
the database even if the switch flipped.

- Why load-bearing: the kill switch is necessary but not sufficient. The
  launch checklist (Stage B gate B-0) now records the prerequisite explicitly:
  a follow-up migration adding a narrow self-insert path (session user inserts
  exactly their own owner row at organizer creation time) must precede any
  switch flip.
- P10 posture: no switch flip, no grant/policy added; gate recorded.

### N-01 — Redundant `created_by` guard in `prevent_organizer_identity_change()`

Lines 83–88 check `NEW.created_by <> OLD.created_by` (NULL-unsafe `<>`, but
the column is NOT NULL so it behaves) and then repeat the check with
`IS DISTINCT FROM`. The first branch is subsumed by the second. Harmless —
the exception fires either way — but the dead branch should be removed if the
file is ever revised.

### N-02 — Trigger functions lack `SET search_path`

`prevent_organizer_identity_change()`, `prevent_owner_mutation()`, and
`enforce_tournament_lifecycle()` declare no `set search_path`. Bodies use
schema-qualified references (or no table references at all), so behavior is
correct, but project convention (D1 remediation, all SECURITY DEFINER
functions) is an empty search path. Recommend adding `SET search_path = ''`
when these functions are next touched.

### N-03 — Escaping logic duplicated in 06

`search_tournaments` inlines the `replace(replace(replace(...)))` LIKE-escape
instead of reusing `public.escape_organizer_like()`. Behavior matches the 05
helper, but the duplication can drift. Recommend a shared helper call in a
future revision (no behavior change today).

### N-04 — Correlated subselects in the masked RPCs

`search_organizers` and `search_tournaments` resolve the organizer ref / count
with per-row correlated subqueries. Correct under SECURITY DEFINER (owner
bypasses RLS by design — the count intentionally sees all published rows);
potentially slow at scale. A `LEFT JOIN` rewrite plus the composite index
from the index note above is future tuning, gated on real query plans, not
on speculation.

### N-05 — `social_links` and `region_code` rely on the application boundary

No DB-level shape CHECK on `social_links` and no region-vocabulary CHECK on
either table — the Zod schemas and pre-RPC vocabulary enforcement carry the
load. Consistent with the G1 pattern (fail closed at the reader), acceptable
while writes are disabled, worth a CHECK-constraint pass in the hardening
migration if owners want defense in depth.

## What static review cannot prove (hand-off to `runtime-verification.md`)

Trigger firing order under concurrent writers, RLS evaluation under real
anon/authenticated JWTs, DEFINER/RLS interplay for the count subquery, grant
effectiveness through PostgREST, `auth.uid()` wiring, `extensions` schema
resolution, and whole-file replay atomicity are reviewed, never executed.
