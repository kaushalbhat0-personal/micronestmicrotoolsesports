# G1-3 Implementation Report — Game Catalogue & Player Game Profiles

## 1. Verdict

**G1-3 PASS** — migration deployed, server operations implemented, mocked +
live adversarial tests green, remote verification complete, zero residue.

## 2. Preflight and project identity

* Repo `micronestmicrotoolsesports`, branch `new-platform`, HEAD
  `01893ae5b0275979649edb754e4dd9ea6cbaebb7` (expected baseline; G1-1/G1-2
  files remain untracked, as their reports state). Pre-existing unrelated
  items preserved (`M .gitignore`, `?? AGENTS.md`, `?? docs/audits/...`);
  nothing staged, committed or pushed in this stage.
* Remote (explicit ref): id `knniommcyyhbyiwljisk`, name
  `micronestmicrotoolsesports`, region `ap-northeast-1`, status
  `ACTIVE_HEALTHY`, PG `17.6.1.171`. Sibling `whitelabel-lms`
  (`iwgefthgciddukqabkun`) never accessed.
* History before: exactly `...001` foundation, `...002` storage,
  `...135602` identity anchor, `...135654` grant tightening, `...141108`
  player profile. Public schema held `app_users` + `player_profiles`
  (both RLS, 0 rows) — no `games`/`player_game_profiles`, no conflicts.
* `pgcrypto` confirmed in `extensions` schema (migration qualifies
  `extensions.gen_random_uuid()` for that reason).
* G1-0/G1-1/G1-2 reports read. Frozen D-G1-01/02/03/09 followed; actual
  definitions of deferred D-G1-04/05/06/07/08/10 read (not inferred).
* Nothing changed during preflight.

## 3. Migration design

* One additive file:
  `supabase/migrations/20261110000006_g1_game_catalogue.sql` (local file;
  remote record `20261110143759_g1_game_catalogue` — MCP-assigned version).
* Anchors: 03 sections 3/5/7, 05 sections 1/3/6/7, 02 lifecycle, 07 use cases.
* Deployment: `db push --dry-run` unusable (MCP-versioned history; proven in
  G1-2) → MCP `apply_migration` with ONLY the reviewed SQL. Pre-apply grep:
  no `DROP`/`TRUNCATE` (sole matches are `REVOKE` keywords); no
  `ALTER`/`UPDATE`/`DELETE` on existing objects. No history modified.

## 4. Contract reconciliation (Phase 1 gate)

* Catalogue: key PK + CHECK, name, short_name, `is_active` DEFAULT true,
  `created_at`. BGMI seed `('bgmi','Battlegrounds Mobile India','BGMI',true)`
  idempotent (`ON CONFLICT DO NOTHING`). Mutations migration/service-role
  only; SELECT public (anon+authenticated, `USING true`; `is_active`
  filtered at query, not RLS).
* Cardinality RESOLVED (not ambiguous): `UNIQUE (player_user_id, game_key)`
  — exactly one profile per player per game (03 section 3, 05 section 1).
  A second title = catalogue row + validation, never schema redesign.
* Creation requires an existing canonical profile (FK enforces; server maps
  to `MissingPlayerProfileError` — no placeholder auto-creation per 02) and
  a supported ACTIVE title (server checks `is_active`; FK alone cannot).
* D-G1-04 safely deferred: persistence (`game_user_id` text NULL 4–32, no
  UNIQUE), owner-privacy, and omission from the future projection are all
  frozen; only the masked-vs-omit projection choice stays open. No public
  identifier, no verification workflow. No conflict → no STOP.
* Availability value-enum deliberately NOT invented: frozen docs cite only
  non-exhaustive examples (`e.g. weekday-evenings|weekend|flexible` in 03,
  A4). Migration enforces exactly what IS frozen (`NOT NULL DEFAULT '{}'`,
  cap ≤7, GIN) + Zod per-element shape; a closed allowlist lands via a later
  migration (column + GIN already support it). Gate passes without resolving
  any product decision.
* Projection compatibility: `game_key`/`game name` (catalogue join), `ign`,
  `primary_role`, `play_modes`, `region_code`, `availability` all present;
  `game_user_id`/IDs stay base-only (frozen D-G1-03 output).
* 07's `upsertGameProfile` provided as explicit create-or-update (full-input
  create; duplicate → `GameProfileAlreadyExistsError`, never silent
  overwrite; update composes full replacement) to keep error semantics
  predictable. `removeGameProfile` deferred with D-G1-07 (see section 6).

## 5. Schema

`public.games`: `key` PK + CHECK `^[a-z0-9-]{2,24}$`, `name`/`short_name`
NOT NULL (no invented length CHECKs), `is_active` DEFAULT true,
`created_at`. One row: bgmi/active (live-verified).

`public.player_game_profiles` (live-verified column-for-column):
`id` uuid PK `DEFAULT extensions.gen_random_uuid()`; `player_user_id` FK →
`player_profiles(user_id)` CASCADE; `game_key` FK → `games(key)` RESTRICT;
`ign` 2–30; `game_user_id` NULL 4–32 (no UNIQUE — unverified); `primary_role`
NULL ∈ {IGL,Assaulter,Support,Scout}; `play_modes` `text[] NOT NULL DEFAULT
'{}'` cap 5 + 5-subset; `region_code` NULL ∈ 7-value BGMI vocab (`online`
only here); `availability` `text[] NOT NULL DEFAULT '{}'` cap 7;
`is_visible` DEFAULT true; timestamps + reused trigger. No ranks, scores,
K/D, badges, `verification_status` (all forbidden/open).

Indexes: `UNIQUE (player_user_id, game_key)`; partial btree
`(game_key, region_code, primary_role) WHERE is_visible = true`; GIN
`(play_modes)`, GIN `(availability)`. Trigger
`trg_player_game_profiles_updated_at` present.

## 6. RLS/policy/grant matrix (live-verified)

* RLS enabled on both tables. `games`: 1 policy — SELECT to anon +
  authenticated `USING (true)`; zero write policies. Grants: SELECT to
  anon/authenticated only (INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER
  revoked from both).
* `player_game_profiles`: exactly 3 policies, `authenticated`-only —
  SELECT `USING (player_user_id = auth.uid())` (reads allowed when
  suspended); INSERT/UPDATE with owner + inline active-status `EXISTS`
  (consistent with G1-1/G1-2; the `WITH CHECK` also blocks ownership
  transfer — verified live). Grants: SELECT/INSERT/UPDATE to authenticated
  only; DELETE/TRUNCATE/REFERENCES/TRIGGER revoked; nothing to anon/public.
* No owner DELETE policy/grant (D-G1-07 deferred, consistent with G1-2;
  owner DELETE verified no-op, row survives). No `SECURITY DEFINER`
  anywhere (single-statement ops need no transactional RPC — narrowest
  design investigated and documented in the migration header).
* `app_users`/`player_profiles` definitions, policies and grants unchanged.

## 7. Server operations and validation

* `domain/game-profile.ts`: `GameProfile`, `GameCatalogueEntry`, six
  generic domain errors (no DB detail, no PII).
* `schemas/game-profile.ts`: strict create/update inputs reusing G1-0
  boundaries; `region_code` validated per-`game_key` via dispatcher
  (unknown game + region fails closed); `ONLINE` valid only as BGMI region;
  `player_user_id`/`id`/`game_key`-in-patch rejected; update requires ≥1
  field. `schemas/index.ts` barrel extended.
* `server/game-profile.ts` (`(client, …)` only — no user-ID parameter):
  `listSupportedGames` (public, no session, active-only, explicit columns);
  `getOwnGameProfiles` (read-only); `createGameProfile` (Zod → session →
  `ensureAppUser` gate → canonical-exists check → catalogue active check →
  single INSERT; `23505` → AlreadyExists deterministically — id is random;
  `23503` → Unsupported; `23514` → Validation); `updateGameProfile`
  (gameKey selector + strict partial, region re-validated, allowlist
  payload, 0-rows → suspended re-gate → NotFound). No service-role, no
  `next/headers`, no `select *`.

## 8. Test matrix

* Unit (`npm test`, no network): 123/123 across 13 files (35 new: 11 in
  `game-profile.test.ts` schemas, 24 in `game-profile-ops.test.ts`
  operations). Covers catalogue visibility, session derivation, arity-2
  identity proof, canonical-required, unknown/inactive games, vocab
  rejections, mass assignment, deterministic 23505, FK/CHECK mapping,
  foreign-row fail-closed, suspension-vs-not-found, message safety. Two
  harness bugs during development (non-chainable `.eq()` fake; weak
  catalogue assertions) were test-only, fixed, documented.
* Live (`game-profile.integration.test.ts`, G1_TEST_MODE-gated): 21/21
  first run green — signup emptiness, unauthenticated rejection, anon
  catalogue-visible/game-rows-blind, canonical-required, happy-path create
  (defaults `is_visible` true), inactive-hidden-from-creation with existing
  rows preserved, duplicate, full invalid-input battery (incl.
  country-vs-region separation `IN`-rejected/`online`-accepted),
  5-way concurrency → 1 row, second catalogue row (test-only seed) → 2
  rows, cross-user read/update/create denied, ownership transfer denied,
  update preserves canonical row (byte-compared), mass assignment rejected,
  Zod+CHECK invalid updates, safe not-found, DELETE no-op, catalogue writes
  denied, suspended write-block with reads intact.

## 9. Adversarial findings and resolutions

* None blocking. All 9 scenarios verified live (Section 8 + RLS
  introspection). `is_visible` accepted in create/update is approved (07
  inputs; inert without master consent) — not mass assignment.
* Updating a profile of an inactive title is allowed (RLS permits; hiding
  is a creation/discovery concern) — documented, not invented as a block.
* Check-then-insert catalogue race (deactivation between SELECT and INSERT)
  accepted as residual (admin-only action; G1-4 RPCs predicate `is_active`
  regardless); FK race maps to `UnsupportedGameError` with catalogue
  re-check on retry.

## 10. Security/performance advisors

* Security: 0 lints.
* Performance (recorded, not suppressed): `auth_rls_initplan` WARN on all
  owner policies incl. pre-existing G1-1/G1-2 ones — the frozen
  `auth.uid()`-direct expression style, kept identical across stages for
  auditability; optimizable later without semantic change. `unused_index`
  INFO on prefilter/GIN indexes — forward-looking per 05 section 1 (tables
  empty; RPC consumers land in G1-4).

## 11. Residue and cleanup

* Privileged counts after both runs: `player_game_profiles` 0,
  `player_profiles` 0, `app_users` 0, `auth.users g1t3_%` 0. Test-only
  catalogue seed removed in-test (`finally`) + afterAll; `games` holds only
  `bgmi`/active. Temp env-loader deleted. No broad selectors ever used.

## 12. Regression

* `npm run typecheck` PASS; `npm run lint` (full repo) PASS, no warnings;
  `npm test` 123/123 (13 files); `npm run build` PASS (routes unchanged:
  `/`, `/_not-found`, `/api/health`; `middleware`-deprecation notice
  pre-existing). No unrelated modules touched.

## 13. Deferred decisions preserved

* D-G1-04 (projection form), D-G1-05 (no throttle invented),
* D-G1-06 (upload untouched), D-G1-07 (no delete flows; DELETE policy/grant
  omitted on both new tables), D-G1-08 (no completion flag — game rows
  exist but no derived completeness), D-G1-10 (no discoverability gate),
  D-08/D-09 untouched. Availability value-enum explicitly left open (see
  section 4). No scores/ranks/badges/verification, no Teams/Orgs/Brands/
  vacancies/DMs, no RPCs, no routes/UI.

## 14. Git status

* HEAD `01893ae…`, branch `new-platform`. Untracked (new): migration
  `20261110000006_g1_game_catalogue.sql`, `domain/game-profile.ts`,
  `schemas/game-profile.ts`, `server/game-profile.ts`,
  `tests/game-profile.test.ts`, `tests/game-profile-ops.test.ts`,
  `tests/game-profile.integration.test.ts`, this report. Modified: `schemas/
...[truncated 398 chars]