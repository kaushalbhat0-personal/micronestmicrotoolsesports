# 04 — Admin & Audit Boundary (F-A01 / F-A02 / F-A03 / F-A04 / F-A06)

## F-A01 — Suspended admins rejected

`is_super_admin()` (`M3 §A`) now requires both membership and
`app_users.status='active'`, identity strictly from `auth.uid()`. Missing rows,
suspended/inactive users, and anon callers all yield false. Grants unchanged
(revoke-public, authenticated-execute). No user-id parameter exists.

## Actual threat model (F-A02 / F-A03 / F-A04)

| Role | Capability after M3 |
|---|---|
| `anon` / `authenticated` | Nothing on admin tables (no policies; revoke-all incl. explicit TRUNCATE revoke). `is_super_admin()` callable by authenticated only, returns a boolean. Audit forgery via PostgREST: **impossible**. |
| `service_role` / table owner | Bypasses RLS by engine design; row triggers still fire (append-only + cron lifecycle enforced on DML). `TRUNCATE` bypasses row triggers (engine limit, documented). Secret-bearing audit rows rejectable only by app discipline. |

Stated plainly in the rewritten table comments (`M3 §C`): writes are
service-role-only after app-layer `requireSuperAdmin`; there is no RLS read/write
path and no DEFINER write helper in D1; the "including service-role" guarantee
covers DML, not TRUNCATE. Owner/service-role truncate is governed by the ops
runbook (separate privileged boundary), not by these triggers.

## What was NOT built

No `record_admin_audit()` helper, no grant/revoke RPCs, no audit viewer, no
dashboard, no `TRUNCATE` grant to any API role. A DEFINER audit-write API is a
platform-admin decision and stays BLOCKED.

## Hardening (F-A06)

All three admin trigger functions recreated with `SECURITY INVOKER` +
`SET search_path=''` + revoke-all from public/anon/authenticated (`M3 §B`).
Trigger firing on DML is unaffected by the revokes (G1 `handle_updated_at`
pattern). Cron lifecycle logic itself unchanged.

## Files

- SQL: `supabase/migrations/20261112000003_d1_security_remediation.sql` §§A,B,C.
- Tests: `src/server/admin/admin-boundary.test.ts` (static + secret-scan unit).
