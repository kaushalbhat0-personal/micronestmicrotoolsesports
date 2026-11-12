# G1-7 Implementation Report — Owner Settings, Consent, Profile Lifecycle and Hard Deletion

Date: 2026-11-11
Branch: `new-platform` (HEAD `01893ae`)
Project: `micronestmicrotoolsesports` / ref `knniommcyyhbyiwljisk` (`ap-northeast-1`, PostgreSQL 17) — verified, sibling never touched.

## 1. Verdict

**PASS.** All approved G1-7 scope is implemented, migrated, tested live and green:

- Decision freeze synchronized (D-G1-05, D-G1-07, D-G1-08 + discoverability copy, 2026-11-11).
- One additive lifecycle migration + one additive function fix, both applied remotely.
- Direct-PostgREST bypass closed via column-level grants (live-proven 42501 denials).
- Consent, game visibility, handle change (~30-day atomic cooldown), derived completeness, game-profile removal and canonical-profile hard deletion all live green.
- Full unit suite 251/251; live lanes: G1-7 15/15, G1-2 16/16, G1-3 21/21, G1-4 13/13, G1-5 10/10 (one CDN-propagation flake, re-passed in isolation).
- Typecheck, ESLint and production build green. Zero test residue. No commits, no pushes, no deployment.

One load-bearing defect was found by the live lane and fixed (see §4): the handle DEFINER function raised 42702 (OUT-parameter/column ambiguity). Fixed additively, re-probed, full suite re-green. No weakened implementation was accepted at any point.

## 2. Decision freeze changes

`10-open-decisions.md` and `11-decision-freeze.md` updated, original wording/options preserved, approved resolutions + implementation consequences appended, date 2026-11-11:

- **D-G1-05 Option A (throttled):** ~30-day cooldown, app-enforced; uniqueness stays case-insensitive; normalization unchanged; no generic-patch mutation; auditable during operation only, no permanent moderation audit history. CLOSED.
- **D-G1-07 Option A (hard delete):** game-profile removal + canonical-profile deletion only. Whole-account deletion excluded; no Auth/`app_users`/unrelated/other-user deletion; immediate handle reuse; no surviving audit history; no grace/pending/purge/scheduler. CLOSED.
- **D-G1-08 (approved set):** complete = handle + display name + (avatar OR bio) + ≥1 game profile. Derived, not stored; informational only (no verification/trust/eligibility/skill implication). CLOSED.
- **Discoverability copy:** title "Make my player profile discoverable" + frozen paragraph (see §6). Defaults false, reversible, per-game visibility independent, withdrawal immediate on next RPC, no added projection fields. APPROVED.
- D-G1-10 and unrelated decisions untouched. No conflicting frozen document remains (remaining `10` references to D-G1-05/07/08 as "open" were rewritten to CLOSED; `04/05/07/08` describe mechanisms, not decision status).

## 3. Preflight evidence

- Branch `new-platform`, HEAD `01893ae`, worktree clean of unrelated changes; all pre-existing uncommitted work (G1-1..G1-6 files, `.gitignore`, `AGENTS.md`) preserved, nothing committed or pushed.
- Primary project verified via MCP: name `micronestmicrotoolsesports`, ref `knniommcyyhbyiwljisk`, region `ap-northeast-1`, status `ACTIVE_HEALTHY`, PG `17.6.1.171`. Sibling `whitelabel-lms` never accessed.
- Remote migration history (7 records): foundation, storage, identity anchor, grant tightening, player profile, game catalogue, public projection. Tables: `app_users`/`player_profiles`/`player_game_profiles` RLS-on, 0 rows; `games` 1 row (`bgmi`).
- Schema facts driving the design:
  - No `handle_changed_at` or any handle-change timestamp existed. `updated_at` advances on ANY profile edit → proven invalid as a cooldown proxy. Durable cooldown therefore requires additive persistence (§4).
  - No owner DELETE policy/grant on either profile table (fail-closed, as designed).
  - Owner UPDATE was column-unrestricted (table-level grant + row-only RLS): direct PostgREST writes to `handle`/`is_discoverable` were possible — the bypass closed in §5.
  - Functions: `ensure_app_user` + `create_player_profile` (INVOKER), `search_player_directory` + `get_player_by_handle` (DEFINER, frozen), `handle_updated_at` (INVOKER trigger).

## 4. Handle cooldown implementation

- Additive column `player_profiles.handle_changed_at timestamptz NULL` (`...00008` migration). Semantics: NULL = no prior dedicated change (eligible); set to `now()` ONLY by a successful `update_player_handle` call. `updated_at` is never read as a proxy (documented in column comment).
- Narrow DEFINER function `public.update_player_handle(p_handle)` (`SECURITY DEFINER, search_path=''`, fully qualified, no dynamic SQL, `auth.uid()` only, active-status gate, `REVOKE ALL FROM PUBLIC/anon`, `GRANT EXECUTE TO authenticated`):
  - Normalizes (`lower(btrim())`), strict regex/length validation (22000 → `ProfileValidationError`).
  - Row lock (`SELECT ... FOR UPDATE`) + cooldown check (`handle_changed_at + interval '30 days'`) + update in ONE transaction: concurrent attempts serialize; only success stamps the marker; validation/collision failures leave it intact; same-value no-op returns the row without advancing.
  - Cooldown breach raises `HANDLE_COOLDOWN:<eligible_at>` (P0001) → `HandleCooldownError` carrying `nextEligibleAt`; unique violation → `HandleTakenError` (generic, no owner leak).
  - Suspended → `SuspendedError`; missing profile → `ProfileNotFoundError`.
- **Defect found live, fixed:** first version used unqualified `where user_id = v_uid`; the `RETURNS TABLE` OUT parameters shadow column names → 42702 "column reference user_id is ambiguous", surfaced as generic `ProfileOperationError` (fail-closed, caught by the live lane: 4 handle tests failed, 11 others passed). Fixed in `...00009` (`where public.player_profiles.user_id = v_uid` + comment), re-probed directly (success row with fresh `handle_changed_at`), full suite re-green 15/15. Local `...00008` file synchronized to the fixed text.
- Server: `server/handle.ts` (`updateHandle`, `getHandleChangeState` for UI cooldown display). Generic `updatePlayerProfile` still rejects `handle` via Zod `.strict()` (unit-tested).
- Post-cooldown success proven live via test-owned backdate of `handle_changed_at` (−31d, service-role, own test row only).

## 5. Direct PostgREST bypass prevention

- `...00008` replaces table-level UPDATE grants with column-level grants:
  - `player_profiles`: UPDATE only on `(display_name, bio, country_code, avatar_path, updated_at)`. `handle`, `is_discoverable`, `user_id`, `handle_changed_at` are unwritable directly.
  - `player_game_profiles`: UPDATE only on `(ign, game_user_id, primary_role, play_modes, region_code, availability, is_visible, updated_at)`. Ownership/catalogue/identity columns unwritable.
- Verified live (`direct PostgREST writes ... are denied`): direct `handle` and `is_discoverable` updates return errors (42501) and stored values are unchanged; approved generic columns (e.g. `display_name`) still write — no regression. Remote `role_column_grants` inspected to confirm the exact allowlists (§13).
- The `handle_updated_at` trigger keeps working (column grant includes `updated_at`); existing owner UPDATE/INSERT/SELECT flows re-verified live across G1-2/G1-3/G1-4/G1-5 lanes.

## 6. Consent operations and copy

- Server: `server/consent.ts` — `getDiscoverabilityState` (read) + `setDiscoverability` (strict `{is_discoverable: boolean}` → `set_player_discoverability` DEFINER, active-gated, session-only). Suspended → `SuspendedError`; missing profile → `ProfileNotFoundError`; foreign-row echo → fail-closed `ProfileOperationError`.
- Narrow DEFINER `public.set_player_discoverability(p_value)` with the same hardening as §4 (anon revoked).
- Approved copy rendered verbatim in `/settings/profile` (§6 text): title + paragraph + default-off note + "both master and per-game visibility required" explanation.
- Live: default false → enable → directory row appears → disable → next RPC call excludes + `getPlayerByHandle` null → re-enable restores. Another user toggling their own consent leaves A's stored flags untouched. Suspended users cannot toggle; suspension already suppresses public rows via the `status='active'` RPC predicate, and the stored value is restored on reactivation — administrative changes while suspended are service-role only (documented, not built).

## 7. Game visibility operations

- `server/game-visibility.ts` — `getGameVisibility` (read one owned flag, null when absent) + `setGameProfileVisibility` (strict `{is_visible: boolean}`, delegates to the owner-bound `updateGameProfile`; game key is the selector, never patchable). New `setGameVisibilityInputSchema` in `schemas/game-profile.ts`.
- Live: hide → directory excludes + handle 404-equivalent → show restores; master-off overrides visible-on; cross-user isolation holds. Column grants preserve `is_visible` writability through the owner path only.

## 8. Profile completeness helper

- `server/completeness.ts` — pure `getProfileCompleteness({handle, displayName, avatarPath, bio}, gameProfileCount)` → `{complete, missing[]}` with missing codes `handle | display_name | avatar_or_bio | game_profile`. No DB, no stored flag, no projection dependency, no verification/trust language.
- 7 exhaustive unit tests: complete, avatar-only, bio-only, blank-name/bio rejection, zero vs ≥1 game profiles, all-missing aggregation. Deletion-of-last-game → incomplete proven live.

## 9. Game-profile deletion

- `removeGameProfile(client, gameKey)`: session-only, Zod key, `ensureAppUser` gate, exact `DELETE ... player_user_id = uid AND game_key = key ... RETURNING`, 0-row → suspended-vs-notfound disambiguation → `GameProfileNotFoundError`.
- Deletes exactly one owned row: canonical profile, other game rows, catalogue entries untouched (live-verified). Missing selector → safe not-found (idempotent retry shape). Concurrent double-delete → one success + one not-found (covered by pattern; live lane covers concurrent handle path explicitly).
- No storage involvement (game profiles own no objects); canonical avatar never touched here.

## 10. Canonical-profile deletion

- `deletePlayerProfile(client)`: session-only, no ID argument. Reads own row (fail-closed when absent) → storage-first exact-path cleanup (current `avatar_path` + all canonical variants for the session UID) → `DELETE player_profiles WHERE user_id = uid` (associated game rows via approved FK cascade).
- Preserves `app_users`, Auth identity, catalogue rows, all other users (all live-verified: anchor row + Auth user + B's rows + `bgmi` survive). Handle immediately reusable (fresh user C created with the freed handle live).
- Storage failure → `ProfileDeletionError`, DB delete aborted (unit-proven ordering: `["storage-remove"]` with no `db-delete`); never a false success. DB failure after storage → generic retryable error; next retry re-runs the same bounded exact-path cleanup (documented §11). Storage-then-DB non-atomicity is inherent (two systems); no global sweeper invented.
- Suspended users are blocked (`SuspendedError`, live-verified, row survives); reactivation restores the normal path.
- UI requires typed-handle + checkbox confirmation; whole-account deletion is never offered (see §19).

## 11. Storage cleanup and recovery behavior

- Ordering per 06 §5: storage first, DB second. Upload path untouched. Delete paths use exact owned paths only (`{uid}/avatar.{png,jpg,jpeg,webp}` + current `avatar_path`); no listing, no prefix sweep, no other-user targeting (unit-asserted prefix containment).
- Failure modes: storage error aborts the DB write (no dangling pointer, no false success); DB error after storage leaves a row whose `avatar_path` may point at a removed object — the next attempt re-runs the same bounded cleanup and completes. Live lane: avatar removed with the profile, `storage.objects` 0 afterwards, no stale public URL (directory regression), canonical delete with a live avatar object exercised.
- Known platform behavior (unchanged): public-CDN reads may serve a deleted object briefly — one G1-5 replacement assertion needed its built-in 12s poll and passed on re-run (flake, not a product change; see §14).

## 12. Migration and remote deployment ID

Additive only; no previous migration modified; no reset; no broad DELETE/TRUNCATE:

- `supabase/migrations/20261111000008_g1_owner_settings_lifecycle.sql` — column, 2 DELETE policies, DELETE grants, column-grant tightening, 2 DEFINER functions + least grants. Applied as remote `20261111090645 / g1_owner_settings_lifecycle` — success.
- `supabase/migrations/20261111000009_g1_handle_function_fix.sql` — 42702 ambiguity fix (re-created function + re-asserted grants). Applied as remote `20261111091947 / g1_handle_function_ambiguity_fix` — success.
- Pre-apply review: exact project ref, additive-only, no `TRUNCATE`/broad delete, grants least-privilege. Sibling untouched (all calls used `knniommcyyhbyiwljisk`).

## 13. Security/RLS/grant/function matrix

| Object | Policy / Grant | Result (remote-verified) |
|---|---|---|
| `player_profiles` SELECT/INSERT/UPDATE (owner, active-gated) | preserved | G1-2..G1-5 live lanes green |
| `player_profiles owner delete` (owner + active) | created | owner self-delete works; anon/cross-user denied |
| `player_game_profiles owner delete` (owner + active) | created | same |
| DELETE grant | `authenticated` on both profile tables only | no anon DELETE; `games`/`app_users` unchanged |
| UPDATE grant `player_profiles` | columns `(display_name, bio, country_code, avatar_path, updated_at)` | direct `handle`/`is_discoverable` writes denied live |
| UPDATE grant `player_game_profiles` | columns `(ign, game_user_id, primary_role, play_modes, region_code, availability, is_visible, updated_at)` | ownership/catalogue columns unwritable |
| `set_player_discoverability` | DEFINER, `search_path=''`, auth.uid-only, active gate, anon revoked, `authenticated` execute | live consent round-trip green |
| `update_player_handle` | same hardening + atomic cooldown + OUT-param qualification fix | live cooldown/collision/concurrency green |
| `search_player_directory` / `get_player_by_handle` | unchanged (definition re-read remotely: frozen 12 cols, 4-conjunct predicates, escaping, limits) | G1-4 13/13 + G1-7 regression green |

Advisor findings (recorded, no action needed): the two pre-existing DEFINER-executable WARNs (G1-4 RPCs, intentional per D-G1-03) now list the two new functions under authenticated-only (anon correctly absent); `auth_rls_initplan` (frozen style) and `unused_index` (forward-looking) unchanged.

## 14. Unit and live adversarial results

- Unit: **251/251** (`npm test`). 49 new G1-7 tests: `consent-ops` 11, `handle-ops` 12, `completeness` 7, `deletion-ops` 12, `game-visibility-ops` 7. Pre-existing fixtures updated for `handle_changed_at` (2 files); behavior otherwise unchanged.
- Live G1-7 (`lifecycle.integration`, `g1test_` identities, exact cleanup): **15/15** — consent default/toggle, bypass closure, withdrawal immediacy, visibility independence + master override, cross-user isolation, first change + stamp, cooldown rejection + non-advancement (validation + collision), backdated post-cooldown success, suspended restrictions, concurrent-change safety (1 success + 1 safe rejection), game-row isolation, canonical delete (games + avatar gone; anchor/Auth/B/catalogue survive; handle reused), anon/cross-user denial, suspended-delete block, 12-column/no-leak regression.
- Regression lanes live: G1-2 **16/16**, G1-3 **21/21**, G1-4 **13/13**, G1-5 **10/10** (one CDN-propagation flake on the replace-avatar download assertion — owner listing proof passed; re-ran the single test in isolation: pass. Not a product regression; no code change).
- Legacy integration helpers updated to the new privilege reality: G1-4/G1-5 `setDiscoverable` helpers now use the `setDiscoverability` op (direct flag writes are denied by design); G1-2/G1-3 "owner DELETE has no effect" tests rewritten to the approved G1-7 behavior (delete succeeds for own row, others survive, row recreated for lane tidiness).

## 15. Public discovery regression

- Frozen 12-column key set asserted live on directory + handle responses (`handle, display_name, avatar_url, bio, country_code, game_key, game_name, ign, primary_role, play_modes, region_code, availability`).
- No `game_user_id`, internal IDs, or suspension markers in any serialized public card (live `JSON.stringify` sweep).
- Consent withdrawal suppresses directory + profile route; deleted handles return generic null → `notFound()`; no stale avatar URL (`avatar.webp` rollover asserted, NULL-after-remove asserted).
- G1-4 RPC definitions re-read remotely — unchanged.

## 16. Test cleanup proof

- Remote counts after all lanes: `app_users` 0, `player_profiles` 0, `player_game_profiles` 0, `games` 1, `storage.objects[public-avatars]` 0.
- Cleanup is exact tracked IDs/paths in reverse dependency order (profile → app_users → Auth; storage exact paths). No truncate/reset/broad selectors used anywhere.

## 17. Security/performance advisor findings

- `anon_security_definer_function_executable`: only the two G1-4 RPCs (intentional, D-G1-03; same as prior gates).
- `authenticated_security_definer_function_executable`: G1-4 RPCs + the two new G1-7 functions (intentional; anon revoked on the new ones — confirmed absent from the anon list).
- `auth_rls_initplan`: includes the two new DELETE policies (same frozen inline-`EXISTS` style as all existing policies; accepted per 11 §4).
- `unused_index`: the four pre-existing forward-looking indexes (unchanged).
- No new unexpected findings; no remediation required.

## 18. Known limitations

- Public-CDN reads may briefly serve a deleted avatar after storage removal (observed once: >12s stale download while the authoritative listing was already correct). Owner listings and directory rows are authoritative; the UI never treats CDN as the security boundary.
- Handle-taken remains an accepted enumerable residual (generic message, no owner info).
- Cross-system atomicity (Storage + PostgreSQL) is bounded-retry, not transactional (documented §10/§11).
- Suspended users cannot self-serve consent withdrawal or deletion; suppression is already enforced by RPC predicates while suspended; administrative path is service-role only.
- Cooldown is exactly 30 days ("approximately 30 days" per approval); eligibility timestamps are surfaced to the owner only.
- `next build` prints a pre-existing `middleware`-convention deprecation warning (untouched file, out of G1-7 scope).

## 19. Explicit exclusion of whole-account deletion

G1-7 implements NO account deletion. `deletePlayerProfile` preserves `app_users` rows and Supabase Auth identities (both live-verified surviving). The settings UI states "Deleting your player profile does not delete your login or account" and offers no account-deletion control. No Auth admin delete, no `app_users` delete, no cascade beyond the player's own profile/game rows exists in any G1-7 path.

## 20. Files changed

Migrations (new):

- `supabase/migrations/20261111000008_g1_owner_settings_lifecycle.sql`
- `supabase/migrations/20261111000009_g1_handle_function_fix.sql`

Docs:

- `docs/architecture/g1-identity-player-profile/10-open-decisions.md` (D-G1-05/07/08 + copy approved)
- `docs/architecture/g1-identity-player-profile/11-decision-freeze.md` (8 approvals, behavior, gates)
- `docs/architecture/g1-identity-player-profile/G1-7-implementation-report.md` (this file)

Feature (`src/features/player-profile/`):

- `domain/player-profile.ts` (`handle_changed_at`, `HandleCooldownError`, `ProfileDeletionError`)
- `schemas/game-profile.ts` (`setGameVisibilityInputSchema`)
- `server/player-profile.ts`, `server/avatar.ts` (column lists incl. `handle_changed_at`)
- `server/consent.ts`, `server/handle.ts`, `server/completeness.ts`, `server/game-visibility.ts`, `server/deletion.ts` (new)
- `tests/consent-ops.test.ts`, `tests/handle-ops.test.ts`, `tests/completeness.test.ts`, `tests/deletion-ops.test.ts`, `tests/game-visibility-ops.test.ts`, `tests/lifecycle.integration.test.ts` (new)
- `tests/player-profile.test.ts`, `tests/avatar-ops.test.ts` (fixture: `handle_changed_at: null`)
- `tests/directory.integration.test.ts`, `tests/avatar.integration.test.ts` (consent helper → `setDiscoverability` op)
- `tests/player-profile.integration.test.ts`, `tests/game-profile.integration.test.ts` (DELETE tests → approved G1-7 behavior)

App:

- `src/app/settings/profile/page.tsx`, `actions.ts`, `_components/` (5 section components)
- `src/components/shared/site-header.tsx` (Settings nav link)

## 21. Git status

Uncommitted (nothing committed or pushed, per constraints): pre-existing `M .gitignore`, `M src/components/shared/site-header.tsx` (extended), `?? AGENTS.md`, `?? docs/architecture/`, `?? docs/audits/`, `?? src/app/players/`, `?? src/app/settings/`, `?? src/features/player-profile/`, `?? supabase/migrations/20261110*` (G1-1..G1-6) + `?? supabase/migrations/20261111000008*` + `?? supabase/migrations/20261111000009*`. No application deployment performed.

## 22. Next gate recommendation

G1-7 is complete; recommend opening **public onboarding preparation**, gated on still-open **D-G1-10** (email-confirmation gate for discoverability) plus `site_url`/allowlist hardening per 11 §7 — with D-G1-07 now closed. Suggested pre-work: decide the D-G1-10 position, confirm `site_url` and redirect allowlists, and set search/handle-availability throttling numerics (the remaining open numeric dependency). No further G1-7 work is required.
