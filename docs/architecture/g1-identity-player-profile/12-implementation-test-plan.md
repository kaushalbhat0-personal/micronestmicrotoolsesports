# 12 — Implementation Test Plan (G1-0 scaffold; DB tests PLANNED)

Status: PLANNED. No database integration test has been executed in G1-0.
No test users created. No writes to the primary Supabase project.
Pure validation tests (`src/features/player-profile/tests/`) prove input
boundaries only — they do not prove RLS or database security.

## 1. Test lanes

| Lane | Location | Supabase | Run in G1-0 |
|---|---|---|---|
| Pure unit (Zod, mappers) | `src/**/*.test.ts` | None | Yes (`npm test`) |
| Application-level (actions with mocked client) | `src/**/*.test.ts` | Mocked | From G1-1 |
| Authenticated integration | `src/**/*.integration.test.ts` | Real anon/authenticated keys only | From G1-1 (`npm run test:integration`), never in G1-0 |
| RLS adversarial | `src/**/*.integration.test.ts` | Real; two authenticated identities A/B + anon | From G1-1 |
| RPC projection | `src/**/*.integration.test.ts` | Real; anon + non-owner + owner | From G1-4 |

`npm test` excludes `*.integration.test.ts` by design. Integration files exist
only from their stage onward and are skipped until their migration lands.

## 2. G1-1 identity tests (PLANNED)

Authoritative: 02, 05 §3-§4, 08 T2/T4, 11 §3 (D-G1-01/D-G1-02).

* Unauthenticated bootstrap rejected (anon `INSERT INTO app_users` → 0 rows / denied; `ensureAppUser` without session → `401`).
* Authenticated user can initialize their own row (`INSERT id = auth.uid()` → 1 row; second call idempotent).
* Caller cannot initialize another user's identity (spoofed `userId` ignored; session wins; RLS `WITH CHECK id = auth.uid()` denies cross-row insert).
* Repeated bootstrap is idempotent (`ON CONFLICT DO NOTHING` twice → 1 row).
* Concurrent bootstrap produces one row (parallel calls → 1 row, no unique-violation surfacing).
* Suspended account remains blocked (suspended fixture → `ensureAppUser` returns generic denial; no onboarding pass; writes denied via `EXISTS status='active'`).
* Owner cannot UPDATE `app_users` (any owner UPDATE → denied, incl. `status`).
* Owner cannot change status or administrative flags (crafted `status='active'` / `suspension_reason` → denied/ignored; `.strict()` DTOs reject).
* Missing `app_users` row follows the recoverable path (onboarding-required; retryable; app data first, auth last on delete).

## 3. G1-2 profile tests (PLANNED)

Authoritative: 03 §1/§7, 04 §1, 05 §1/§3, 08 T2/T4.

* One player profile per application user (second create → `409`/unique).
* Owner-only creation and editing (non-owner read/write → 0 rows / denied; anon → 0 rows).
* No owner access to another user's private profile (authenticated B reads A's base row → 0 rows).
* Discoverability defaults `false` (fresh profile absent from RPC fixtures until explicitly enabled).
* Mass assignment rejected (extra `user_id`/`status`/`is_discoverable=true` smuggled into generic patch → rejected/ignored; dedicated consent action only).
* Invalid `country_code` rejected at Zod + CHECK (incl. `ONLINE`; full allowlist mirror test).
* Handle rules identical at DB + Zod (`ABC` vs `abc` → 1 row; overlong/illegal → CHECK denial).

## 4. G1-3 game-profile tests (PLANNED)

Authoritative: 03 §3/§5, 05 §1, 09 G1-3, D-G1-09.

* Multiple games per player (seed second catalogue row in test only; two game profiles → 2 rows).
* Unique player/game relationship (`ON CONFLICT (player_user_id, game_key)` upsert; duplicate insert → conflict path, not second row).
* Invalid `game_key` rejected (unknown key → FK/Zod denial).
* Game-specific region validation (BGMI vocab accepts `india`/`online`; unknown game's vocab rejects BGMI-only values; `validateGameRegion` unknown game → false).
* `ONLINE` cannot enter `country_code` (rejected at Zod + CHECK).
* Visibility independently enforced (`is_visible=false` row hidden while sibling game stays visible; master-off hides all).

## 5. G1-4 RPC security tests (PLANNED)

Authoritative: 04 §2/§5/§6, 05 §5-§6, 08 T1/T3/T5/T8, 11 §3 (D-G1-03).

* Anonymous base-table SELECT denied (`app_users`, `player_profiles`, `player_game_profiles` → 0 rows).
* Authenticated non-owner base-table SELECT denied (same → 0 rows).
* RPC output matches exact allowlist (key set `===` frozen 12 columns; G1-0 mirror: `public-projection.test.ts`).
* No internal user IDs or private fields (no `user_id`/`id`/email/`game_user_id`/evidence/timestamps in any RPC row).
* Consent disabled means no result (master `false` → absent from search + by-handle empty).
* Game profile hidden means no result (`is_visible=false` → absent for that game).
* Suspended account means no result (status `suspended` → absent everywhere + 404-equivalence).
* Inactive game means no result (`games.is_active=false` → joined rows absent; base rows preserved).
* Revocation takes effect on subsequent calls (toggle off → immediately absent; no background job assumed).
* LIMIT maximum enforced (`limit=48` ok; `49` clamped/rejected; default 24).
* OFFSET bounded (negative rejected; explicit server maximum enforced SQL-side).
* Invalid search inputs rejected (bad handle syntax, overlong query, non-allowlisted enums).
* Wildcard escaping works (`%`/`_`/`\` treated literally via `ESCAPE '\'`; injection strings return literal matches only).
* Not-found behavior does not reveal existence (missing/private/suspended/inactive → identical empty set → caller 404).

## 6. Test identities and cleanup strategy

* Dedicated test accounts only, prefixed `g1test_` in handle/display name, in the single Supabase project. No existing user records touched.
* Each integration file creates only its own rows (bootstrap → profile → game profiles) and deletes them in `afterAll` in reverse dependency order (game profiles → profile → `app_users`), then Auth admin delete last where applicable.
* Cleanup uses narrow, ownership-verified selectors (by the test run's own IDs/handles). Broad deletes (`WHERE handle LIKE ...` without ownership proof, table truncates, global resets) are forbidden.
* Service-role keys never appear in browser/client code or in `*.test.ts` reachable from `src/app/**`, `src/components/**`, `src/lib/**`; admin cleanup helpers live in `src/server/*` test support only, guarded by `typeof window === "undefined"`.
* Fail closed: if `G1_TEST_MODE` (or equivalent stage flag) is unset, or test ownership cannot be verified, integration tests abort before any write.
* No `supabase db reset`, no storage bucket wipes, no Auth bulk deletes — ever.

## 7. Harness rules (frozen for G1-1..G1-4)

* Pure unit tests never import Supabase clients.
* Application tests mock the client; RLS behavior is asserted only in integration lane.
* Adversarial tests always use two independent authenticated identities (A/B) plus anon.
* Every stage ships only with its lane green; `npm run db:types` regeneration after G1-2/G1-3 (disposable-safe path; primary untouched until the project's approved workflow allows).
* Lint guard from G1-1: no `src/server/*` imports in `src/app/**`, `src/components/**`, `src/lib/**`.
