---
name: testing
description: "Use when writing or reviewing tests — Vitest 3.2.4, meaningful unit/service/security-boundary tests, not test theater."
---

# Testing — Vitest (3.2.4)

**When to use:** Adding or reviewing tests in `src/**/*.test.ts` (Vitest), especially service, validation, auth, entitlement, RLS.

**When not to use:** Pure style tweak with no logic, or docs-only.

**Source:** Adapted from PyModel React Frontend Skills — `vitest` skill (MIT) + project `vitest.config.ts:1`. Installed **Vitest 3.2.4** (`npm run test` / `test:watch`).

## Rules

**Rule: Meaningful, not count**
Why: Test theater wastes time.
Good: `src/lib/auth/organization-context.test.ts:1` — 6 tests for org context: member allowed (org-a), non-member denied (org-b → NOT_FOUND/403), nonexistent 404, spoofed slug denied, switcher only own orgs, sponsor-sentinel requires membership first. `src/server/services/entitlement-service.test.ts:1` — 5 tests including all-access precedence, expired, inactive tool. `src/lib/validation/validation.test.ts:1` — `isSafeRedirect` IDOR redirect check.
Bad: `it('renders', () => expect(<Button>).toBeDefined())` — no behavior.

**Rule: Isolation + deterministic**
Why: Flaky tests hide RLS bugs.
Good: `vitest.config.ts:1` `environment: node`, `globals: true`, `alias: {"@": "./src"}`, mock at boundary: `vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(...) }))` `src/lib/auth/organization-context.test.ts:1`, `vi.mock("@/server/repositories/organizations", ...)` for pure service tests.
Bad: Hitting real Supabase in unit test — use `findOrganizationContext` mock, keep integration to `supabase db reset`.

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
- [ ] `npm run test` passes, no hard waits, no external network?

See `vitest.config.ts:1`, `ARCHITECTURE.md` Verification, and `security` skill for cases.
