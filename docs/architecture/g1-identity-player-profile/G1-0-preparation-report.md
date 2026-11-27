# G1-0 Preparation Report — Implementation Foundation (no implementation)

## 1. Repository preflight

* Repository: `micronestmicrotoolsesports`. Branch: `new-platform`.
* HEAD: `01893ae5b0275979649edb754e4dd9ea6cbaebb7` (matches expected `01893ae`).
* Status before edits: `M .gitignore`, `M next-env.d.ts`, `?? AGENTS.md`,
  `?? docs/architecture/g1-identity-player-profile/01..10`, `?? docs/audits/...`.
* Status after: same, plus new `src/features/player-profile/**` (18 files),
  `12-implementation-test-plan.md`, this report. Nothing staged, no commits.
* Generated-file note: the pre-existing `M next-env.d.ts` diff is no longer
  present after `npm run build` (Next.js regenerated the file during the
  authorized build). `.gitignore` modification preserved. No other unrelated
  file touched.
* All eleven G1 documents (01–11) read. Conventions found: `@/*` alias,
  Vitest (`src/**/*.test.ts`, `*.integration.test.ts` excluded from `npm test`),
  Zod v4, `src/lib/supabase/*` anon clients, `src/server/*` service-role only,
  `src/features/README.md` greenfield convention, `example.test.ts` naming.

## 2. Architecture traceability

| Approved requirement | Doc § | Feature module | Validation boundary | Test |
|---|---|---|---|---|
| Lazy bootstrap (D-G1-01 frozen) | 02 §2–§3, 11 §3 | deferred to G1-1 (no impl) | — | 12 §2 PLANNED |
| No owner UPDATE (D-G1-02 frozen) | 05 §3, 11 §3 | deferred to G1-1 RLS | — | 12 §2 PLANNED |
| Handle syntax/length | 03 §1/§7, 05 §1 | `schemas/handle.ts` | `handleInputSchema` (strict) | `tests/handle.test.ts` |
| Display name / bio | 03 §1, 05 §1 | `schemas/profile.ts` | `displayNameSchema`, `bioSchema` | `tests/profile.test.ts` |
| Country ISO alpha-2, never ONLINE (D-G1-09) | 03 §1, 05 §1, 11 §3 | `schemas/country-code.ts` | `countryCodeSchema` (format-only; allowlist at G1-2 migration) | `tests/country-code.test.ts` |
| Game catalogue key | 03 §2, 05 §1 | `schemas/game.ts` | `gameKeySchema` | `tests/game.test.ts` |
| Per-game region, BGMI-only vocab (D-G1-09) | 03 §3, 05 §1, 11 §3 | `schemas/game.ts` | `makeGameRegionSchema`, `validateGameRegion` (unknown game → false) | `tests/game.test.ts` |
| BGMI roles/modes, availability cap, IGN, game_user_id | 03 §3/§5, 05 §1 | `schemas/game.ts` | `bgmiPrimaryRoleSchema`, `bgmiPlayModesSchema`, `availabilitySchema` (shape-only), `ignSchema`, `gameUserIdSchema` | `tests/game.test.ts` |
| Discoverability explicit boolean (default false) | 03 §1, 04 §2, 07 | `schemas/discoverability.ts` | `setDiscoverabilityInputSchema` (strict) | `tests/consent.test.ts` |
| Creation mass-assignment resistance (T4) | 07, 08 T4 | `schemas/create-profile.ts` | `createPlayerProfileInputSchema` (strict; no is_discoverable/user_id/status) | `tests/consent.test.ts` |
| Directory search / by-handle (D-G1-03) | 05 §5, 07, 11 §3 | `schemas/directory.ts` | `searchDirectoryInputSchema` (limit 1..48, offset ≥0, query ≤120), `getPlayerByHandleInputSchema` | `tests/directory.test.ts` |
| Frozen 12-column projection (D-G1-03) | 04 §5, 05 §5, 11 §3 | `domain/public-projection.ts` | `PUBLIC_PROJECTION_COLUMNS` (logic-free) | `tests/public-projection.test.ts` |
| RLS/RPC matrices G1-1..G1-4 | 08, 09, 11 §4 | `12-implementation-test-plan.md` | lanes + ownership-verified cleanup | PLANNED, not executed |

No existing utility duplicated (`@/lib/env`, Supabase clients reused by reference only; nothing imported from `ref/legacy-project/`).

## 3. Files created and modified

Created (20):
* `src/features/player-profile/README.md`
* `schemas/`: `handle.ts`, `profile.ts`, `country-code.ts`, `game.ts`, `discoverability.ts`, `create-profile.ts`, `directory.ts`, `index.ts`
* `domain/public-projection.ts`
* `tests/`: `handle`, `profile`, `country-code`, `game`, `consent`, `directory`, `public-projection` (`.test.ts`)
* `docs/architecture/g1-identity-player-profile/12-implementation-test-plan.md`
* This report.

Modified: none (docs 01–11 untouched; source untouched outside the new feature dir).
Minimal config changes: none required (existing Vitest/globals/alias covered the scaffold).

## 4. Schema inventory and rationale

* `handleSchema` — `trim().toLowerCase()` + `^[a-z0-9_]{3,20}$` (03 §1/05 §1). No throttle/availability (D-G1-05 open).
* `displayNameSchema` — trim, 1–40, markup guard (03 §1). `bioSchema` — optional, trim, ≤280, markup guard (link policy stays action-layer per 07).
* `countryCodeSchema` — trim, uppercase, `^[A-Z]{2}$`, explicit ONLINE refine (D-G1-09). Format-only; seed allowlist deferred to G1-2 migration (not invented).
* `gameKeySchema` — `^[a-z0-9-]{2,24}$` (05 §1). `bgmiRegionSchema` + `validateGameRegion` — BGMI vocab frozen set; unknown games rejected (D-G1-09; BGMI never universal).
* `bgmiPrimaryRoleSchema` / `bgmiPlayModesSchema` — frozen enums (max 5 modes). `availabilitySchema` — shape-only (tokens ≤48, max 7); enum frozen at G1-3 (not invented).
* `ignSchema` — trim 2–30. `gameUserIdSchema` — optional text 4–32 per 05 CHECK (leading zeroes preserved); projection omits per D-G1-03, masked form stays under open D-G1-04.
* `createPlayerProfileInputSchema` — strict; rejects `is_discoverable`/`user_id`/`status` (08 T4; creation forces undiscoverable).
* `setDiscoverabilityInputSchema` — strict explicit boolean (client value never authorizes publish).
* `searchDirectoryInputSchema` — strict; limit 1..48 default 24 (frozen), offset int ≥0 default 0 (server max SQL-side at G1-4), query trim 1..120 (scaffold DoS guard; authoritative bound at G1-4), region/role shape-only (per-game allowlist at action layer).
* Barrel `index.ts` re-exports schemas only. `domain/public-projection.ts` holds the frozen 12-column tuple (no logic, no DB).
* Schemas validate input only. No database operations, no service-role, no persistence.

## 5. Test results

* `npm run typecheck` — PASS (one scaffold typo fixed: `profile.test.ts` paren).
* `npx eslint src/features/player-profile` — PASS, no warnings.
* `npm test` — PASS: 8 files, 37 tests (36 new + 1 existing `example`).
* `npm run build` — PASS (Next 16.4.6 Turbopack; 3 routes unchanged: `/`, `/_not-found`, `/api/health`).
* Playwright — SKIPPED (no routes/UI added; browser run not warranted for a validation-only scaffold).
* No `*.integration.test.ts` created or run in G1-0. DB/RLS validation is NOT claimed from unit tests.

## 6. RLS/RPC test plan coverage

`12-implementation-test-plan.md` defines PLANNED lanes: pure unit (done) vs mocked application (G1-1) vs authenticated integration / RLS adversarial / RPC projection (G1-1..G1-4, two identities A/B + anon). Covers all required bullets: G1-1 bootstrap/idempotency/concurrency/suspended/no-UPDATE/recoverable; G1-2 one-profile/owner-only/default-false/mass-assignment/country; G1-3 multi-game/uniqueness/key/region/ONLINE/visibility; G1-4 base-denied/allowlist-exact/no-PII/consent-hidden/suspended/inactive/revocation/LIMIT/OFFSET/inputs/escaping/404-equivalence. Harness: dedicated `g1test_` accounts, own-rows-only narrow cleanup, no global reset, service-role server-only, fail-closed without test-mode flag.

## 7. Deferred decisions preserved

D-G1-04 (projection form), D-G1-05 (throttle numbers; query-120 is a documented scaffold guard, not the product limit), D-G1-06 (avatar flow untouched), D-G1-07 (no delete flows), D-G1-08 (no completion flag), D-G1-10 (no discoverability gate), D-08/D-09 ( untouched). No unapproved fields (no scores/ranks/badges), no Teams/Orgs/Brands/vacancies/DMs/feeds/payments.

## 8. Supabase write confirmation

No migrations, tables, functions, policies, Auth/Storage changes, or client writes. No Supabase CLI `db` commands run. No test users created. Single project `knniommcyyhbyiwljisk` never accessed for writes (only pre-existing env references; no new credentials).

## 9. Git status and commit state

Branch `new-platform`, HEAD `01893ae...`. Nothing staged, no commits, no pushes, no deployments. New files untracked as listed in §3. Pre-existing unrelated items preserved (`M .gitignore`, `?? AGENTS.md`, `?? docs/audits/...`, G1 docs 01–11 unmodified).

## 10. Recommendation for G1-1

Proceed to G1-1 (identity anchor + lazy bootstrap) with the frozen safeguards: owner-client `ensureAppUser` (session ID only, re-select + status check, suspended blocked, idempotent/concurrent-safe), no-middleware-writes, no owner UPDATE/DELETE on `app_users`, mocked-action tests first, then `*.integration.test.ts` per 12 §2 with dedicated `g1test_` identities and ownership-verified cleanup. G1-4 remains blocked on D-G1-04.
