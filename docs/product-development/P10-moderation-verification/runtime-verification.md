# P10 runtime verification

## Question

Can the two P9 migrations be executed and their PostgreSQL/RLS behavior
verified in an approved local environment — without Docker, without a
second/disposable Supabase project, without remote database writes, and
without touching the Whitelabel LMS project?

## Answer: NO — runtime verification is BLOCKED in this phase

This reproduces the D1.5.2 conclusion (`docs/product-discovery/
D1.5.2-runtime-verification/04-runtime-harness-feasibility.md`), re-inventoried
for the P9 migration pair on 2026-11-12.

### Inventory (verified this phase)

- **Dependencies:** `package.json` test tooling is vitest only. No `pg-mem`,
  `@electric-sql/pglite`, `testcontainers`, `embedded-postgres`, `pg`, or
  `postgres` server dependency is installed. `node_modules` carries only
  Supabase *client* libraries (`supabase-js`, `postgrest-js`, `ssr`).
- **Harnesses:** `src/server/` contains no embedded-postgres harness. The
  `*.integration.test.ts` lane gates on live `URL/ANON/SERVICE` keys plus a
  `G1_TEST_MODE` flag and performs isolated writes against the single
  project — unusable here twice over (remote writes forbidden; keys absent).
- **Docker:** a Docker client exists on this machine (`29.9.2`), but Docker
  use is prohibited by the phase constraints, so `supabase start` (which
  requires it) is unavailable regardless of the binary's presence.
- **Supabase CLI:** present (`2.109.1`), but without a runnable backend it
  cannot replay migrations.
- **Emulators:** pg-mem has no privilege system and treats GRANT/REVOKE as
  no-ops (per its own positioning and the D1.5.2 analysis) — it cannot
  enforce the exact properties under test (RLS USING/WITH CHECK switching,
  column/update grants, DEFINER boundaries). PGlite would genuinely enforce
  them but is not installed, needs a binary download, still leaves
  Supabase-specific wiring unharnessed (`auth.uid()` JWT claims,
  anon/authenticated role switching per request, GoTrue isolated identities,
  `extensions.gen_random_uuid()`), and installing it would violate the
  new-dependency rule. Both are **rejected as security gates**; neither result
  (green or red) would constitute evidence about production behavior.

### Strongest safe simulation performed instead

1. **Clause-by-clause static SQL review** (`migration-review.md`) — every
   table, constraint, FK, trigger, policy, grant, RPC, and search-path
   setting read in application order, cross-checked against the G1–P8
   baseline objects they depend on.
2. **Simulated authorization matrix** — new and existing unit suites exercise
   the permission matrix (`canRoleTransition`, `canTouchVerification`), the
   lifecycle allow/deny table, kill-switch pins, forged-value rejection, and
   route audits with fake clients and static source assertions. These prove
   *application-layer intent*, never database behavior, and are labeled as
   such in every claim.

### Behaviors that remain UNVERIFIED (explicit)

1. Both migration files have never executed: syntax, trigger creation, and
   policy creation are reviewed, not run.
2. Trigger firing order and interaction (`updated_at` vs guard triggers)
   under concurrent writers.
3. RLS policy evaluation under real anon/authenticated JWTs, including
   `auth.uid()` wiring and the active-account subselects.
4. SECURITY DEFINER + RLS interplay for the `published_tournament_count`
   subquery and the organizer-ref fallback.
5. Grant effectiveness through PostgREST role switching (anon vs
   authenticated vs table owner).
6. `extensions` schema resolution and `gen_random_uuid()` availability in the
   target project.
7. Whole-sequence replay atomicity (05 → 06) and rollback behavior.
8. Performance: GIN usage, correlated-subquery cost, pagination over-read.

### Consequences (binding on the launch checklist)

- Both write switches stay OFF (recorded in §9 of the final report).
- No migration is applied, remotely or otherwise.
- Findings F-01/F-02/F-03 in `migration-review.md` must be resolved by named
  follow-up migrations before their gated capabilities enable.
- The least-risky future verification remains the D1.5.2 prescription: a
  separately authorized disposable replay (or `supabase start` where Docker
  is permitted) running the migrations in order, exercised by
  run-scoped isolated identities with tracked-id cleanup — never against the
  primary project without explicit approval.
