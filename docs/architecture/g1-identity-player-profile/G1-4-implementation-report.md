# G1-4 Implementation Report — Public Player Directory Projection

## 1. Verdict

**G1-4 PASS** — decision freeze synchronized (D-G1-04 closed Option A),
migration deployed, DirectoryReader implemented, mocked + live adversarial
tests green, remote verification complete, zero residue.

## 2. Decision-freeze synchronization

* D-G1-04 product-owner approval dated 2026-11-11 (Option A, eight-point
  wording) is authoritative. It was not re-asked.
* `10-open-decisions.md`: header now lists D-G1-01/D-G1-02/D-G1-03/D-G1-04/
  D-G1-09 as APPROVED; D-G1-04 section rewritten as APPROVED (Option A,
  omit, 2026-11-11, closed) with the full eight-point position; stage-gate
  entry now reads CLOSED with G1-4 proceeding on the frozen 12 columns.
* `11-decision-freeze.md`: five approvals; provenance extended with the
  2026-11-11 Option A record; §3 gains the identifier-privacy frozen
  behavior; §5 gains the D-G1-04 affected-documents line (D-G1-09 line
  preserved); §6 remaining-open list drops D-G1-04; §7 gate now reads
  "G1-4 requires D-G1-03 + D-G1-04 (both frozen; authorized 2026-11-11)".
* D-G1-03 and D-G1-04 are both closed. No other deferred decision was
  touched (D-G1-05/06/07/08/10, D-08/D-09 remain open per `10`/`11`).
* Ancillary sync (not frozen-doc edits): `schemas/game.ts` comment now
  records D-G1-04 closed Option A; `src/features/player-profile/README.md`
  scope + deferred list updated to G1-4.

## 3. Preflight evidence

* Repo `micronestmicrotoolsesports`, branch `new-platform`, HEAD
  `01893ae5b0275979649edb754e4dd9ea6cbaebb7` (unchanged baseline).
  Pre-existing uncommitted items preserved (`M .gitignore`, `?? AGENTS.md`,
  `?? docs/architecture/`, `?? docs/audits/`,
  `?? src/features/player-profile/`, `?? supabase/migrations/2026111000000{3,4,5,6}_*.sql`);
  nothing staged, committed or pushed.
* Remote (explicit ref): id `knniommcyyhbyiwljisk`, name
  `micronestmicrotoolsesports`, region `ap-northeast-1`, status
  `ACTIVE_HEALTHY`, PG `17.6.1.171`. Sibling `whitelabel-lms`
  (`iwgefthgciddukqabkun`) never accessed.
* History before: exactly `...001` foundation, `...002` storage,
  `...135602` identity anchor, `...135654` grant tightening, `...141108`
  player profile, `...143759` game catalogue — no G1-4 objects.
  Pre-deploy introspection confirmed: only `create_player_profile`
  (invoker) existed; `search_player_directory`/`get_player_by_handle`
  absent; RLS enabled on all four tables.
* Architecture + G1-1/G1-2/G1-3 reports read. D-G1-03/D-G1-04 definitions
  read (not inferred). Nothing changed during preflight.

## 4. Migration details and remote ID

* One additive file:
  `supabase/migrations/20261110000007_g1_public_projection.sql` (local file;
  remote record `20261111072251_g1_public_projection` — MCP-assigned version,
  same MCP-versioned pattern as G1-2/G1-3).
* Deployment: `db push` unusable (MCP-versioned history, proven in G1-2/G1-3)
  → MCP `apply_migration` with ONLY the reviewed SQL. First attempt failed
  fast and safely on `pg_catalog.greatest(integer, integer) does not exist`
  (GREATEST/LEAST are not schema-qualifiable functions); fixed by replacing
  both clamps with keyword `CASE` expressions (search_path-independent),
  re-reviewed, re-applied — success. No partial state (single migration,
  second attempt created both functions).
* Pre-apply grep-equivalent review: no `DROP`/`TRUNCATE`/`ALTER`/
  `UPDATE`/`DELETE` on existing objects — only `CREATE OR REPLACE FUNCTION`
  (two new names), `COMMENT ON`, `REVOKE`/`GRANT` on the new functions.
  No history modified, no table/policy/grant changes.

## 5. Exact RPC signatures

* `public.search_player_directory(p_game text DEFAULT null, p_region text
  DEFAULT null, p_role text DEFAULT null, p_query text DEFAULT null,
  p_limit integer DEFAULT 24, p_offset integer DEFAULT 0)` RETURNS `TABLE`
  (frozen 12, §6). `LANGUAGE sql STABLE SECURITY DEFINER` with
  `SET search_path = ''`. Owner `postgres` (live-verified).
* `public.get_player_by_handle(p_handle text)` RETURNS `TABLE` (frozen 12,
  §6). Same hardening. Owner `postgres` (live-verified).
* `TABLE(...)` (not a composite type) was chosen per the frozen alternative
  ("explicit composite or TABLE(...)"): no extra type object, fixed column
  list that schema changes cannot widen.

## 6. Exact 12-column output contract

Both functions return, in this order (live-verified via
`pg_get_function_result` on both):
`handle, display_name, avatar_url, bio, country_code, game_key, game_name,
ign, primary_role, play_modes, region_code, availability`.
`avatar_url` carries the stored relative `avatar_path`; the reader resolves
it to a public storage URL (06 §2). `game_name` derives from the
`games.name` join (live-asserted). Excluded: `game_user_id` (full + masked),
all user/profile/game IDs, email/phone, verification/evidence, timestamps,
flags — verified absent from both function bodies
(`ilike '%game_user_id%'` false, `ilike '%execute %'` false,
`ilike '%select *%'` false).

## 7. Security model and grants

* `search_path = ''` on both (live-verified via `proconfig`); all tables
  `public.`-qualified; all function calls `pg_catalog.`-qualified except
  keywords (`coalesce/nullif/case/ilike/escape`) and operators, which are
  search_path-independent. No dynamic SQL anywhere.
* `REVOKE ALL ... FROM PUBLIC` then `GRANT EXECUTE ... TO anon,
  authenticated` on both (live-verified via `role_routine_grants`; no
  PUBLIC grant; `postgres`/`service_role` entries are ownership defaults).
* Anon EXECUTE on DEFINER functions is intentional (frozen D-G1-03: the
  directory is public); the advisor WARNs for this pattern are accepted
  with the audited hardening as mitigation (see §13).
* Input validation SQL-side: `CASE` clamps (LIMIT 1..48, OFFSET 0..1000),
  trim + `LEFT(...,120)` on the query, backslash/percent/underscore
  escaping with deliberate `ESCAPE '\'`, handle regex
  `^[a-z0-9_]{3,20}$` on lowercased input (fail closed → empty set),
  unknown game/region/role match zero rows (fail closed, no oracle).
* No base-table policy/grant changed (live-verified: RLS on all four
  tables; grants identical to G1-3 state — anon SELECT on `games` only;
  authenticated owner-scoped CRUD, no anon on base rows).

## 8. Consent and visibility enforcement

All four conjuncts are static predicates inside both functions (never
caller-supplied): `pp.is_discoverable = true AND pgp.is_visible = true AND
au.status = 'active' AND g.is_active = true`. Revocation is immediate on
the next call (live-proven: master-off, per-game-off, suspend, and
deactivate each hide the row on the very next RPC; restore brings it back).
`get_player_by_handle` returns zero rows for missing/private/suspended/
inactive/invisible (404-equivalence, live-proven indistinguishable).

## 9. DirectoryReader design

* `server/directory-reader.ts` (`(client, …)` only — no user-ID parameter at
  all: directory reads are identity-free by design; any client incl. anon).
  No service-role, no `next/headers`, no base-table reads for others.
* `searchDirectory`: Zod parse → per-game allowlist (known game `bgmi`:
  region via `validateGameRegion`, role via `BGMI_ROLES`; unknown games
  pass through to fail-closed RPC) → `rpc("search_player_directory", …)`
  with explicit NULLs → exact-12 key-set assertion (order-sensitive
  tripwire) → strict per-field mapping → avatar path resolved via
  `storage.from("public-avatars").getPublicUrl` (offline URL building;
  NULL stays NULL).
* `getPlayerByHandle`: accepts raw string or `{handle}`; Zod normalize →
  RPC → 0 rows maps to `null`; >1 rows is a fail-closed
  `DirectoryOperationError` (impossible in G1: UNIQUE (player, game) + one
  title); else strict map.
* `domain/directory.ts`: `PublicPlayerCard` (exactly the frozen 12, with a
  `Exclude`-based compile-time guard) + `DirectoryValidationError`/
  `DirectoryOperationError` (generic messages, no PII).
* Errors never leak PostgREST detail; mass assignment rejected (`.strict()`
  schemas; reader arity asserted by construction — no identity parameter).

## 10. Unit and live test results

* Unit (`npm test`, no network): **137/137 across 14 files** (123 carried +
  14 new in `tests/directory-reader.test.ts`). Covers frozen defaults,
  exact 12-key order, drift tripwire (extra keys → throw, never forward),
  avatar resolution/NULL, catalogue-derived `game_name`, Zod rejections
  (limits/offset/query/game/unknown keys), per-game region/role allowlists,
  generic error mapping, malformed-row fail-closed, by-handle
  normalize/reject/null/multi-row-tripwire.
* Live (`tests/directory.integration.test.ts`, G1_TEST_MODE-gated): **13/13
  first run green** (~36 s). Covers anon/non-owner base denial, eligible-only
  search with exact key order, owner-private `game_user_id` stored but never
  projected (`not.toContain("00998877")`), master/per-game withdrawal +
  restore, suspend + restore, deactivate + restore with base survival,
  case-insensitive lookup + 404-equivalence (missing/private/hidden → null),
  filter narrowing without leakage, unknown-value fail-closed, malformed
  rejection, literal `%`/`_`/`\` matching (no wildcard enumeration),
  injection strings as data, LIMIT floor (0→1 row) + OFFSET floor
  (-5→rows) behaviorally with ceiling via definition review + Zod tests,
  far-OFFSET emptiness, and G1-1/G1-2/G1-3 owner regression.

## 11. Adversarial test evidence

* Enumeration: bare `%` returns only literal-% rows (A), never the
  directory; `_` likewise literal; `\` matches nothing; unknown filters
  return empty identically to valid-no-match (no oracle); malformed inputs
  rejected pre-RPC; injection strings (`'; DROP TABLE…`, `' OR '1'='1`)
  return empty, no error.
* IDOR/consent:anon base SELECT on all three private tables → 0 rows;
  non-owner base reads → 0 rows; RPC output never contains IDs or
  `game_user_id`; consent-matrix (master/game/suspended/inactive) proven
  row-absent with immediate effect.
* Pagination-oracle resistance: deterministic `ORDER BY handle, game_key`;
  negative OFFSET and zero LIMIT clamped server-side (no error oracle);
  oversized OFFSET empty without error.

## 12. Remote verification

* Migration history holds `20261111072251_g1_public_projection` after the
  six G1-1..G1-3 records, in order.
* Both functions: `is_definer true`, `vol s` (STABLE), owner `postgres`,
  `search_path=""`, exact 12-column `TABLE` result in frozen order,
  EXECUTE to `anon` + `authenticated` only.
* Bodies: no `game_user_id`, no `EXECUTE`, no `SELECT *`.
* Tables: RLS on, grants unchanged. Catalogue: `bgmi` active restored.
* Residue counts: `player_profiles LIKE 'g1t4_%'` 0, joined game rows 0,
  `bgmi` active 1. Auth test users deleted in `afterAll`.

## 13. Security/performance advisor findings

* Security: 2 WARN families, both the intentional anon/authenticated
  EXECUTE-on-DEFINER pattern (one finding per function each). Accepted:
  D-G1-03 requires public RPC execution; mitigation is the audited
  hardening (§7) + live matrix (§10–§11). No other security lints.
* Performance (recorded, not suppressed): `auth_rls_initplan` WARN on the 8
  pre-existing G1-1..G1-3 owner policies — the frozen `auth.uid()`-direct
  expression style, kept identical across stages for auditability (same as
  G1-3 report §10); optimizable later without semantic change.
  `unused_index` INFO on the discoverable-prefilter + directory/GIN
  indexes — forward-looking per 05 §1; directory indexes now serve the G1-4
  RPCs (usage accrues with traffic).
* No new advisor classes introduced by this migration.

## 14. Cleanup proof

* `afterAll` (ownership-verified, exact tracked ids, reverse dependency
  order): game rows → `games.is_active` restore → profiles → app rows
  (status restore first, satisfying the suspended-CHECK) → auth delete.
  Live-verified: 0/0 residue, `bgmi` active.
* Temp env-loader `scripts/tmp-g1-4-env.mjs` created for the live run and
  deleted afterwards (no secrets committed; `.env` itself untouched and
  untracked-changed by this stage). No broad selectors ever used.

## 15. Regression results

* `npm run typecheck` PASS; full-repo `npm run lint` PASS (no warnings);
  `npm test` 137/137 (14 files); live 13/13; `npm run build` PASS (routes
  unchanged: `/`, `/_not-found`, `/api/health`; `middleware`-deprecation
  notice pre-existing).
* G1-1 (identity/bootstrap), G1-2 (canonical CRUD), G1-3 (owner game CRUD
  incl. owner-private `game_user_id` round-trip) re-proven live in §10.
  No schema or behavior regression in previous gates; no unrelated modules
  touched.

## 16. Known limitations

* OFFSET ceiling (1000) and LIMIT ceiling (48) are enforced SQL-side but
  proven behaviorally only at the floor (0→1, −5→rows) plus definition
  review and Zod tests — full-ceiling behavior needs >48 eligible rows,
  deliberately not seeded on the primary project.
* `avatar_url` is NULL for all current profiles (avatar upload is G1-5);
  path→URL resolution is unit-proven and live-asserted for NULL, not for a
  real object path (no storage writes in G1-4 by design).
* Public endpoint throttling stays open (D-G1-05); the OFFSET clamp is a
  DoS guard, not a rate limit.
* Multi-game `get_player_by_handle` (>1 row) fails closed by design; the
  multi-title shape is a future decision, not assumed here.

## 17. Git status

* HEAD `01893ae5b…`, branch `new-platform`. Untracked (new): migration
  `20261110000007_g1_public_projection.sql`,
  `domain/directory.ts`, `server/directory-reader.ts`,
  `tests/directory-reader.test.ts`,
  `tests/directory.integration.test.ts`, this report.
  Modified: `10-open-decisions.md`, `11-decision-freeze.md`
  (D-G1-04 closure), `schemas/game.ts` (comment), `README.md` (scope).
  Preserved pre-existing items (`M .gitignore`, `?? AGENTS.md`,
  `?? docs/audits/…`, G1-1..G1-3 untracked files). Nothing staged,
  committed or pushed.

## 18. G1-5 recommendation

* Proceed to G1-5 (avatar storage wiring; requires D-G1-06): upload/replace/
  remove flows against the existing `public-avatars` bucket, single-path
  discipline, MIME/size re-validation, cleanup on profile/account delete.
  The G1-4 `avatar_url` path→URL contract is ready to consume real paths.
* Keep G1-6 routes on `DirectoryReader` only (lint-guard against base-table
  imports in route modules); keep G1-7 consent/handle/deletion copy behind
  D-G1-05/D-G1-07/D-G1-08; public onboarding still gated on D-G1-07/D-G1-10.
