# D1.5.1 — Local Security Remediation (No Remote Apply)

## Scope

Local-only remediation of the product-neutral subset of D1.5 findings.
No migration applied. No remote SQL, writes, reads, or project access.
No commits, pushes, or deployments. Sibling `whitelabel-lms` untouched.

## What changed (local files only)

- Added `supabase/migrations/20261112000003_d1_security_remediation.sql`
  (corrective migration; originals `...000001`/`...000002` byte-untouched).
- Added `src/features/teams/tests/team-security-boundary.test.ts` (18 tests, static).
- Added `src/server/admin/admin-boundary.test.ts` (9 tests, static + app helper unit).

## Verdict: CONDITIONAL PASS

All six in-scope defects are remediated at the SQL-text + static-test level;
G1 suite green (335/335), typecheck and lint clean. This is **not** an apply
authorization: PostgreSQL/RLS execution tests still require a disposable replay
(no Docker / second project / `db reset` per constraints), and five finding
families plus all 12 product decisions remain BLOCKED/AWAITING.

| Finding | Status |
|---|---|
| F-T01 ownership takeover | FIXED (static; replay pending) |
| F-T02 applicant forgery | FIXED (static; replay pending) |
| F-A01 suspended super-admin | FIXED (static; replay pending) |
| F-T03 suspended roster/post writes | FIXED (static; replay pending) |
| F-T04 arbitrary member insert | FIXED by denial (static; replay pending) |
| F-T06 LIKE escaping | FIXED (static + pure-unit; replay pending) |
| F-A02 audit DB-boundary gap | PARTIALLY FIXED (clarified + minimal grants; helper BLOCKED) |
| F-A03 misleading comments | FIXED (comments corrected) |
| F-A04 TRUNCATE bypass | PARTIALLY FIXED (revokes re-asserted + runbook; engine limit documented) |
| F-A06 trigger hardening | FIXED (static) |
| F-T05 captain decision path | BLOCKED (needs D1-D3/lifecycle) |
| F-T07 lifecycle/expiry | BLOCKED (needs lifecycle decision) |
| F-T08 PII visibility | BLOCKED (needs privacy approval) |
| F-T09 retention/availability | BLOCKED (needs D1-D9/D1-D8) |
| F-T10/F-T11/F-T12/F-T13 | BLOCKED / deferred (documented, non-blocking) |

## Documents

1. `01-finding-remediation-register.md` — per-finding record.
2. `02-team-ownership-and-membership.md` — F-T01/F-T03/F-T04 design.
3. `03-application-update-boundary.md` — F-T02 design + limitations.
4. `04-admin-and-audit-boundary.md` — F-A01/F-A02/F-A03/F-A04/F-A06.
5. `05-search-escaping.md` — F-T06 G1-parity.
6. `06-test-evidence.md` — execution levels, honest labeling.
7. `07-blocked-product-decisions.md` — what was NOT resolved.
8. `08-migration-readiness.md` — file order, G1 proof, replay gates.
