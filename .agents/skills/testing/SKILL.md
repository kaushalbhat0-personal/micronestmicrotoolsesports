---
name: testing
description: "Use when writing or reviewing tests — Vitest 3.2.7, unit lane vs embedded-postgres integration lane, meaningful service/security-boundary tests, never watch mode in agents."
---

# Testing — Vitest (3.2.7 lockfile, range ^3.2.4)

**When to use:** Adding or reviewing tests in `src/**/*.test.ts(x)` (Vitest), especially service, validation, auth, entitlement, RLS, scanner, billing.

**When not to use:** Pure style tweak with no logic, or docs-only.

**Source:** Adapted from PyModel React Frontend Skills — `vitest` skill (MIT) + project `vitest.config.ts:1`. Installed **Vitest 3.2.7** (`npm run test` / `test:all` / `test:integration` / `test:watch`).

## Test Lanes (anti-loop rule — read first)

- `npm run test` — **unit lane (default for agents):** `vitest run --exclude "**/*.integration.test.ts"`. ~225 files / ~2190 tests, ~45s. Use this for every edit loop.
- `npm run test:all` — full suite incl. `*.integration.test.ts` (embedded-postgres). Slow (minutes), huge output. Run once before merge, not per edit.
- `npm run test:integration` — only `**/*.integration.test.ts` (5 files: consume-free-check, tie-breaker lock, draft-ban x3). Each spins its own embedded-postgres on ports 54331–54345 (~10–30s each, `beforeAll` 180s budget, per-test 60s). Run explicitly, never as a retry loop.
- **NEVER run `npm run test:watch` (or bare `vitest`) in an agent/CI session** — it enters watch mode, never exits, and looks like the model is "looping". Always use `vitest run`-backed scripts. For a single file: `npx vitest run <path>`.

Why this exists: the full suite's size + embedded-postgres startup + massive reporter output overflowed agent context and caused timeout→retry→loop behavior. The unit lane is the fast feedback loop; integration is opt-in.

**Embedded-postgres orphan rule (Windows):** `postgres.exe --forkchild` workers can outlive the vitest worker and inherit stdio, so a piped run never sees EOF and the shell never returns even though tests pass. Every harness `stop()` in `src/server/testing/*-pg-harness.ts` therefore does `pool.end()` → `pg.stop()` capped by `withTimeout(15s)` → `killPortListener(port)` (listener tree-kill via `taskkill /F /T` + sweep of `*embedded-postgres*` binaries only — never a real PostgreSQL). If you ever see the shell hang after a green summary, check `Get-Process postgres` / `Get-CimInstance Win32_Process -Filter "Name='postgres.exe'"` for orphans from `@embedded-postgres` and kill those PIDs; do not kill unrelated postgres.

## Rules

**Rule: Meaningful, not count**
Why: Test theater wastes time.
Good: `src/lib/auth/organization-context.test.ts:1` — org context: member allowed, non-member denied (NOT_FOUND/403), nonexistent 404, spoofed slug denied. `src/server/services/entitlement-service.test.ts:1` — all-access precedence, expired, inactive tool. `src/lib/validation/validation.test.ts:1` — `isSafeRedirect` IDOR redirect check. `src/server/scanner/scan-concurrency.test.ts` — provider budget + concurrency proofs.
Bad: `it('renders', () => expect(<Button>).toBeDefined())` — no behavior.

**Rule: Isolation + deterministic**
Why: Flaky tests hide RLS bugs.
Good: `vitest.config.ts:1` `environment: node`, `globals: true`, `alias: {"@": "./src"}`, `testTimeout: 15s`, `hookTimeout: 180s` (embedded-postgres startup), `pool: forks`. Mock at boundary: `vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(...) }))` `src/lib/auth/organization-context.test.ts:1`, `vi.mock("@/server/repositories/organizations", ...)` for pure service tests.
Bad: Hitting real Supabase in unit test — use `findOrganizationContext` mock, keep integration to `*.integration.test.ts` + `supabase db reset`.

**Rule: Security boundaries first**
Why: Tenant bugs are P0.
Good: Test `requireOrganizationContext` with member vs non-member vs nonexistent; test `resolveEntitlements` with expired `expires_at` and `is_all_access` precedence; test `parseOrThrow` with `createOrganizationSchema`.
Bad: Only testing `formatDate` happy path.

**Rule: Typed mocks**
Why: `strict` catches shape drift.
Good: `function mockSupabase(overrides: Record<string,unknown>) { return overrides as unknown as SupabaseClient }` — minimal, only mocked `from`/`rpc`. `vi.fn(async () => ...)` typed via `importActual`.
Bad: `as any` in test — use `as unknown as SupabaseClient` once at helper boundary with comment.

## Checklist

- [ ] Did I test edge: expired entitlement, duplicate, all-access, inactive tool, IDOR spoof?
- [ ] Mock at repository/`createClient` boundary, not entire DB?
- [ ] Unit lane (`npm run test`) passes, no hard waits, no external network?
- [ ] Integration test (if added): `*.integration.test.ts` suffix, uses `src/server/testing/*-pg-harness.ts`, `beforeAll` starts embedded-postgres, `afterAll` calls `pg.stop()` + `pool.end()`, `vi.setConfig({ testTimeout: 60_000 })` for multi-round-trip races?
- [ ] Agent ran `npm run test` (not watch, not full suite per edit)?

See `vitest.config.ts:1`, `ARCHITECTURE.md` Verification, and `security` skill for cases.
