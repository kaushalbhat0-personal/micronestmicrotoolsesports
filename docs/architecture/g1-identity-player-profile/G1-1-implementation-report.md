# G1-1 Implementation Report — Identity Anchor & Lazy Bootstrap

## 1. Verdict

**G1-1 PASS** — migration deployed, bootstrap operation implemented, mocked +
authenticated adversarial tests green, remote verification complete, zero residue.

## 2. Preflight and exact project identity

* Repo `micronestmicrotoolsesports`, branch `new-platform`, HEAD
  `01893ae5b0275979649edb754e4dd9ea6cbaebb7` (expected `01893ae`). Nothing
  staged; unrelated work (`M .gitignore`, `?? AGENTS.md`, `?? docs/audits/...`,
  G1 docs 01–12 + G1-0 report) preserved untouched.
* Remote (explicit ref, never the stale env var): id
  `knniommcyyhbyiwljisk`, name `micronestmicrotoolsesports`, region
  `ap-northeast-1`, status `ACTIVE_HEALTHY`, PG `17.6.1.171`.
* History before: exactly `20261110000001_foundation_baseline`,
  `20261110000002_storage_foundation`. Public schema held zero tables —
  no `app_users`, no conflicting implementation. No sibling project touched
  (`whitelabel-lms` never accessed).

## 3. Database design and migration

* `supabase/migrations/20261110000003_g1_identity_anchor.sql` (local file;
  remote record `20261110135602_g1_identity_anchor` — the MCP applier assigns
  its own version; content identical, local file kept for lineage):
  `app_users(id uuid PK → auth.users(id) CASCADE, status active/suspended
  default active, suspended_at, suspension_reason, created_at/updated_at
  now(), coherence CHECK (suspended ⇔ suspended_at NOT NULL))`;
  `trg_app_users_updated_at` reusing foundation `handle_updated_at()`;
  INVOKER `ensure_app_user()` (INSERT … ON CONFLICT DO NOTHING + re-select,
  `SET search_path=''`, fully qualified); RLS on; policies: owner SELECT
  (`id=auth.uid()`), owner INSERT (`WITH CHECK id=auth.uid()`); NO owner
  UPDATE, NO owner DELETE, NO anon policies; grants
  SELECT/INSERT/DELETE→authenticated, revoke public + anon.
* `.../20261110000004_g1_identity_anchor_grant_tightening.sql`
  (remote `20261110135654_...`): revokes platform-default UPDATE/TRUNCATE/
  REFERENCES/TRIGGER from authenticated (D-G1-02 letter; RLS already denied,
  this removes the inert surface). No column/policy/behavior change.
* No trigger in `auth` schema, no DEFINER helpers, no discovery policies,
  no player/game fields, no seed data, no foundation edits.

## 4. Bootstrap implementation

* `src/features/player-profile/domain/app-user.ts`: `AppUser {id, status}`,
  `UnauthenticatedError` / `SuspendedError` (generic message, no enumeration)
  / `BootstrapError` (recoverable).
* `src/features/player-profile/server/ensure-app-user.ts`: takes ONLY a
  SupabaseClient (no user-ID parameter — spoofing is unexpressible);
  `auth.getUser()` as sole identity authority → single-statement
  `rpc("ensure_app_user")` (same-transaction INSERT + re-select) → row-count/
  id-match guards → status gate (unknown ⇒ blocked) → `{id, status:active}`.
  No service-role import, no `next/headers` import (call-site injects the
  owner client), no middleware/page wiring (no automatic writes; onboarding
  wiring is G1-7).

## 5. RLS and grant verification (remote introspection)

* Columns: exact 6 approved, correct types/defaults. PK, FK CASCADE, both
  CHECKs present. Trigger `trg_app_users_updated_at` BEFORE UPDATE present.
* `app_users` is the only public table; `rowsecurity=true`.
* Policies: exactly 2, both `authenticated`-only —
  `INSERT WITH CHECK (id=auth.uid())`, `SELECT USING (id=auth.uid())`.
* Grants: authenticated = SELECT/INSERT/DELETE only (UPDATE denied at GRANT
  layer: live probe returned 42501; DELETE has GRANT but zero RLS policies).
  No anon/public grants. Buckets still 3; no storage/auth changes.

## 6. Transaction and concurrency guarantees

* One RPC = one statement = one transaction (INVOKER SQL function; INVOKER
  adds zero privilege — caller RLS still applies, `auth.uid()` internal).
  Two sequential PostgREST calls were rejected as non-compliant with 02 §2.
* Live proof: 5× concurrent `ensureAppUser` → identical row; privileged
  count = 1. Idempotency: repeated calls → same row, count stays 1.

## 7. Suspended-account protection

* Suspended fixture (service-role flip): `ensureAppUser` → `SuspendedError`,
  message `Account unavailable. Contact support if this persists.` (no
  status/id leak). Owner UPDATE to `suspended` denied (42501), so
  self-suspension is impossible. Re-select returns the fresh row, so a
  suspension landing mid-flow is still enforced.

## 8. Mocked test results

* `npm test`: 9 files / 50 tests PASS (13 new in
  `ensure-app-user.test.ts`: no-session/session-error rejected; identity from
  session; arity 1; create/idempotent/transient/empty/multi-row/mismatch →
  recoverable-or-denied; suspended/unknown → blocked; minimal return shape).
* `npm run typecheck` PASS. `npx eslint src/features/player-profile` PASS.

## 9. Integration test results

* `ensure-app-user.integration.test.ts` (9 tests, G1_TEST_MODE-gated,
  fail-closed): 9/9 PASS against the real project with dedicated
  `g1t1_<runid>_{a,b}@example.com` identities — no row at signup; create +
  idempotent; 5-way concurrency → 1 row; cross-user INSERT denied; non-owner
  + anon SELECT → empty; UPDATE denied (42501); DELETE no-effect (row
  survives, verified privileged); anon RPC denied + app 401-equivalent;
  suspended → generic denial.
* Two initial assertion errors were test-expectation bugs, not DB bugs
  (PostgREST denied-DELETE shape is success-with-null-data; anon app call is
  correctly Unauthenticated). Proven via a temporary probe (row survival
  asserted privileged), then probe deleted and expectations corrected.

## 10. Remote migration evidence

* `list_migrations`: `...001` foundation, `...002` storage (pre-existing),
  `20261110135602 g1_identity_anchor`, `20261110135654
  g1_identity_anchor_grant_tightening` (new, additive only).
* Post-run residue: `app_users` count 0, `auth.users` `g1t1_%` count 0 —
  all test rows/users created by the three runs cleaned (tracked-id deletes
  + admin deletes in `afterAll`).

## 11. Regression checks

* `npm run typecheck` PASS; scoped `npx eslint src/features/player-profile`
  PASS (clean). Full `npm run lint` was not re-run: no shared/application
  files were touched (only the new feature dir + migrations), and the scoped
  pass is green; re-run full lint at the next stage touching shared code.
* `npm test` 50/50 PASS. `npm run build` PASS (routes unchanged:
  `/`, `/_not-found`, `/api/health`). Playwright skipped: no routes/UI in
  G1-1 scope. Vitest `.env` note: the runner does not auto-load `.env`;
  integration runs used a temp env-loader (deleted afterwards, no secrets
  printed); the suite self-skips without `G1_TEST_MODE=g1-1` + keys.

## 12. Security findings

* None blocking. All 8 threat scenarios (Phase 6) verified live: cross-user
  create/read denied, self status-change impossible (grant + RLS layers),
  self-delete impossible (RLS default-deny, row proven surviving), anon
  bootstrap denied at DB + app layers, suspended blocked, concurrency
  converges, transient failures retryable.
* Note: `npm run lint` (repo-wide) was not re-run in G1-1; scoped
  `eslint src/features/player-profile` is clean and no files outside the
  feature + migrations were touched. Full lint to be re-run at the next
  stage touching shared code.

## 13. Deferred decisions preserved

* D-G1-04/05/06/07/08/10, D-08/D-09 untouched. No profile/game/RPC code, no
  routes/UI, no deletion workflow, no completion flag, no email gate, no
  throttle invented. `availability`/`query` bounds remain scaffold-local,
  authoritative caps land with their migrations.

## 14. Git status and commit state

* Nothing staged, committed, or pushed. New untracked: 2 migrations,
  `domain/app-user.ts`, `server/ensure-app-user.ts`,
  `tests/ensure-app-user.test.ts` + `.integration.test.ts`, README delta,
  this report. Pre-existing unrelated items unchanged (launcher + probe
  temp files removed).

## 15. Recommended next gate

* **G1-2** (canonical `player_profiles` + handle uniqueness + Zod/DB parity),
  consuming `ensureAppUser` transactionally per 02 §3(4)/07. G1-4 still
  blocked on D-G1-04. Adopt the `REVOKE UPDATE/TRUNCATE/REFERENCES/TRIGGER
  FROM authenticated` pattern in every future domain migration (platform
  defaults exceed the frozen grant sets).
