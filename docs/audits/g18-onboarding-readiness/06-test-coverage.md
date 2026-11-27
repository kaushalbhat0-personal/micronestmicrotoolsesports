# 06 — Test Coverage (as of 2026-11-11)

## 1. Existing automated coverage (carried, per G1 reports + re-run)

- Unit lane `npm test` (excludes `*.integration.test.ts`): **251/251 PASS
  across 24 files** (re-run in this audit, 2026-11-11, no Docker, no second
  project). Covers: Zod boundaries, mappers, `ensureAppUser` mocked flows
  (no-session/session-error, identity-from-session, arity-1, idempotent,
  transient/empty/multi-row/mismatch, suspended/unknown), consent/handle/
  completeness/deletion/game-visibility ops, avatar canonicalization +
  session-derived paths, directory reader (frozen 12-key order + drift
  tripwire, avatar fail-closed, per-game allowlists, generic errors),
  route query parsing + static data-path audit (no base-table/service-role/
  `game_user_id` in route sources).
- Integration lanes (from G1-1..G1-7 reports, real anon/authenticated keys,
  `G1_TEST_MODE`-gated, full cleanup, zero residue): G1-1 bootstrap 9/9,
  G1-2 canonical 16/16, G1-3 game profiles 21/21, G1-4 directory RPC 13/13,
  G1-5 avatar 10/10, G1-7 lifecycle 15/15. Adversarial coverage includes
  cross-user/anon denial, mass-assignment rejection, ownership-transfer
  denial, suspended blocking, concurrency convergence, consent
  withdrawal/restore, 404-equivalence, wildcard/injection literalness,
  LIMIT/OFFSET floor behavior, storage isolation.

## 2. Tests executed in this audit (new evidence)

- `npm test`: 251/251 PASS (24 files). No integration tests run (would
  require creating Auth identities — avoided per constraints; existing
  integration evidence stands).
- `npm run typecheck`: PASS. `npm run lint`: PASS (0 errors, 0 warnings).
- Read-only remote probes (SELECT-only, no PII): policies (12 rows, exact
  owner/anon matrix), functions (6/6, correct `definer` + `search_path=""`
  + 12-column results), table grants, column grants (UPDATE allowlists
  exactly as G1-7 designed), routine grants (anon EXECUTE on the 2 directory
  RPCs only), storage policies (8, unchanged), RPC body checks (no
  `game_user_id`/no `EXECUTE`/no `SELECT *`), advisors (only the accepted
  DEFINER-EXECUTE WARNs), residue counts (all 0 + `bgmi` active).

## 3. Coverage gaps for onboarding (to be closed in G1-8B)

1. Authenticated vs unauthenticated bootstrap: unit-covered; live lane
   exists (G1-1). Gap: no onboarding-route-level test (routes don't call
   bootstrap yet). Close with route-action tests once onboarding UI lands.
2. Unconfirmed identities: NO coverage (no gate, no fixture). After D-G1-10
   (a): add unit (unconfirmed → generic denial on publish) + integration
   (confirm → publish succeeds; email swap → re-lock if supported).
3. Suspended users: covered for bootstrap/consent/deletion/RPC hiding.
   Gap: onboarding-specific copy path (suspended user attempting onboarding
   sees generic guidance, no status leak) — add once UI exists.
4. Duplicate signup: covered at DB/operation layer (PK/UNIQUE determinism).
   Gap: UX-level (same-email re-signup copy must not reveal registration).
   Depends on UNVERIFIED provider enumeration setting — verify first.
5. Login failure: NO app-level coverage (no login UI). Add generic-error
   tests with the login form.
6. Password recovery: NO coverage (no flow). Add request/confirm/redirect
   tests against allowlisted URLs only.
7. Session refresh: indirectly covered (middleware `getUser()` + cookie
   refresh) but no expiry/rotation test. Add lightweight session-refresh
   test in G1-8B; provider expiry values are UNVERIFIED — verify first.
8. Bootstrap concurrency: covered live (5-way → 1 row). Gap: onboarding
   double-submit (two profile creations racing) — covered for profiles
   (second create → 409 live-proven); re-assert at the action layer in G1-8B.
9. Unauthorized profile creation: covered (anon/cross-user denied, RLS +
   active-gate). Keep as regression; no new gap.
10. Rate limiting / enumeration resistance: NO automated coverage (no
    throttle exists). After implementing the G1-8B throttle: add tests for
    burst-rejection shape (generic 429, no existence distinction) and
    direct-RPC loop cost (LIMIT/OFFSET clamps hold).

## 4. Evidence and limitations

- Direct remote Auth-configuration evidence: NONE (no authorized read path;
  all such settings marked UNVERIFIED — this is a finding, not an
  oversight).
- No destructive, persistent-identity, or production-data tests were run in
  this audit. Integration history is cited from G1 reports with exact
  pass counts and cleanup proofs, not re-executed.
- Numeric remote Auth rate limits are not quoted anywhere in this audit
  (none verified). Local `config.toml` numbers are labeled local-dev only.
