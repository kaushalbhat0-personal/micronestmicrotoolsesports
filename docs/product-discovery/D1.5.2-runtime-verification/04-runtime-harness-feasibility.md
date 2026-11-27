# 04 — Runtime Harness Feasibility

Question: can the 18 specs in `05` run in an isolated local environment without
violating constraints (no Docker, no second/disposable hosted project, no
primary-project writes, no `whitelabel-lms`, no new-dependency approval jump)?

## Installed tooling inventory (verified)

- `package.json`: test runner is vitest only; no `pg-mem`, `@electric-sql/pglite`,
  `testcontainers`, `embedded-postgres`, or `postgres` server dependency.
- `node_modules`: only Supabase *client* libraries (`supabase-js`, `postgrest-js`,
  `auth-js`, `ssr`); no database engine of any kind.
- `src/server/`: no testing/embedded-postgres harness exists (only
  `supabase-admin.ts`, `env.ts`, `admin/`).
- Integration lane (`*.integration.test.ts`, e.g.
  `player-profile.integration.test.ts:1-12,36-60`): gated on
  `G1_TEST_MODE=<lane>` plus live `URL/ANON/SERVICE` keys; establishes isolated
  auth users and cleans up tracked ids in reverse order. The pattern is approved
  for a project write — but this phase forbids *any* primary-project write, the
  keys are absent (`.env` in-tree is an empty template), and no second project may
  be used. Lane unusable here by rule, not just by setup.
- `supabase/config.toml` targets CLI-led local development (port 54321+), which
  requires `supabase start` → Docker. Docker is forbidden in this phase.

## Embedded-engine evaluation (no installation performed)

- **pg-mem (pure-JS emulation):** upstream parses `GRANT`/`REVOKE` as no-ops and
  has no privilege system; its own maintainer positions it for unit testing, not
  as a full server; per-request RLS enforcement is absent in the available
  Supabase-compatible fork path (policies created, not enforced). Our remediated
  properties hinge precisely on column-level UPDATE grants (F-T01/F-T02), RLS
  USING/WITH CHECK switching, and DEFINER/INVOKER privilege boundaries — the
  exact behaviors an emulator does not enforce. A green run would prove nothing
  about production behavior, and a red run would prove nothing either. An open
  upstream PR claims fuller RLS, but it is unmerged and still treats
  grants as no-ops. **Not equivalent; rejected as a security gate.**
- **PGlite (real Postgres as WASM):** would genuinely enforce RLS, grants,
  triggers, and DEFINER semantics — but `@electric-sql/pglite` is not installed,
  needs a binary download, and still leaves Supabase-specific behavior
  unharnesssed: `auth.uid()` JWT-claim wiring, `anon`/`authenticated` role
  switching per request (PostgREST semantics), the `auth` schema/GoTrue flows
  for isolated test identities, and `extensions.gen_random_uuid()`. Building
  that harness is new engineering plus a new dependency plus downloads — it
  needs documented need, trade-offs, and explicit approval, which this phase
  does not grant. **Feasible in principle; BLOCKED in this phase.**
- Installing anything to "just try" would violate the new-dependency rule and
  could not be validated as Supabase-equivalent without the very live reference
  it is meant to replace.

## Conclusion: runtime verification is BLOCKED

No sufficiently faithful local runtime exists under the current constraints, and
the acceptance gate must not be weakened to force progress: static + pure-unit
evidence stays at its honest level (see D1.5.1 `06-test-evidence.md`).

Least-risky future option (requires separate authorization): a disposable
Supabase project (or `supabase start` where Docker is permitted) running the
migrations in order, exercised by the repo's existing isolated-identity pattern
— per-lane `G1_TEST_MODE`-style gate, `run_id`-scoped test users/handles/slugs,
tracked-id cleanup in reverse dependency order, never truncate/reset, service
role confined to setup/verification/cleanup — executing exactly the specs in
`05`. That is the only environment that can enforce the grant/RLS/DEFINER
properties these fixes depend on.
