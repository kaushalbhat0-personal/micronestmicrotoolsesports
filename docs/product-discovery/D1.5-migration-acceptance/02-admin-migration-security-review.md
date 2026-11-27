# 02 — Admin Migration Security Review (`20261112000001`)

File: `supabase/migrations/20261112000001_d1_admin_foundation.sql` (144 lines).
Design reference: `docs/product-discovery/D1-discovery-foundation/03-admin-audit-design.md`.
Pure helpers: `src/server/admin/audit.ts` (+ `audit.test.ts`, 6 tests).

## Objects

| Object | Lines | Purpose |
|---|---|---|
| `platform_admins` | 8–13 | `user_id PK → app_users CASCADE`, `granted_by → app_users SET NULL`, `granted_at`, `reason 5–500` |
| `is_super_admin()` | 18–26 | `SQL STABLE SECURITY DEFINER SET search_path=''`, `EXISTS (platform_admins WHERE user_id = auth.uid())` |
| `admin_audit_logs` | 31–42 | append-only audit: `actor SET NULL`, `action ^[a-z_]+\.[a-z_]+$`, `target_type 2–40`, `target_id uuid`, `reason ≤500`, `before/after jsonb`, `ip` regex, `created_at` |
| `prevent_admin_audit_mutation()` + trigger | 47–59 | `BEFORE UPDATE OR DELETE` → raise (append-only) |
| `cron_run_ledger` | 61–70 | `job_id/run_id 2–120`, `status running/succeeded/failed`, `UNIQUE(job,run)` |
| `enforce_cron_run_ledger_lifecycle()` + triggers | 75–109 | INSERT must be `running` + no `completed_at`; UPDATE only `running→succeeded|failed` + immutable ids + `completed_at` required |
| `prevent_cron_ledger_delete()` + trigger | 111–123 | `BEFORE DELETE` → raise |
| RLS + grants | 125–144 | RLS on all 3 tables; revoke-all anon/authenticated/public on tables; `is_super_admin` revoke-public + grant-authenticated |

## Prove / reject

1. **Ordinary users cannot grant themselves platform-admin.** PROVED.
   No INSERT/UPDATE/DELETE policy on `platform_admins`; `REVOKE ALL`
   (133–135). PostgREST insert fails (RLS default-deny). Bootstrap requires
   service-role (operational path, undocumented — F-A05).
2. **No caller-controlled user ID substitutes for `auth.uid()`.** PROVED.
   Only identity reference in the migration is `auth.uid()` (25, and helpers
   consume it). No `p_user_id` parameter exists. App pure helpers take no identity.
3. **Administrative authorization at the DB boundary.** REJECTED (gap).
   No policy references `is_super_admin()`; no DEFINER read/write helper for
   `admin_audit_logs`/`cron_run_ledger` exists despite the header comment
   (4–6) and `03` claiming "writes via DEFINER helpers". Current DB posture is
   service-role-only after app-layer `requireSuperAdmin` (future code, not in D1).
   Safe default-deny via PostgREST, but forgery/misuse by a service-role holder
   or app bug is not DB-checked (F-A02).
4. **Audit records cannot be modified/deleted by ordinary/API users.** PROVED
   for DML via PostgREST (no policies + revoke + trigger). NOT proved for
   `TRUNCATE` by table owner/service-role: row triggers do not fire on
   `TRUNCATE` (F-A04). `authenticated` cannot truncate (revoked), but the
   "any role including service-role" comment (44–46) overstates the guarantee.
5. **Audit insertion cannot forge privileged actions.** REJECTED at DB boundary.
   `action` regex + `target_type` length are DB-checked; forbidden-secret scan
   (`password/secret/token/session/hash/api_key/service_role/signature`) exists
   only in app (`audit.ts:12-21,44-63`), never in SQL. Service-role insert can
   store secrets or arbitrary `action/target` (F-A02). PostgREST forgery by
   ordinary users is blocked (no policy), but defense-in-depth is missing.
6. **Sensitive values/secrets not recorded.** PARTIAL. App helpers
   `findForbiddenAuditKey`/`projectAuditRecord` enforce redaction + caps, but
   nothing in SQL prevents a service-role insert containing secrets. Requires
   procedural control until a DB helper exists.
7. **Cron ledger transitions narrow and validated.** PROVED for INSERT/UPDATE/
   DELETE via triggers (81–98, 116). Gaps: no `completed_at >= started_at`
   check, no `error_summary`-only-on-failure rule, `TRUNCATE` bypass (F-A04,
   F-A07).
8. **No unintended anonymous access.** PROVED. No anon policy; revoke-all
   (133–141); `is_super_admin` not granted to anon (143–144: revoke-public then
   grant-authenticated only).
9. **DEFINER search_path + qualification.** PROVED for `is_super_admin()`
   (`SET search_path=''`, `public.*` + `auth.uid()`). REJECTED for the three
   trigger functions (47–55, 75–101, 111–119): `plpgsql` with no
   `SET search_path`, no explicit `SECURITY INVOKER` (F-A06). Bodies only
   `RAISE`, so no injection today — hardening gap, inconsistent with G1 posture.
10. **Execute grants minimal.** PROVED for `is_super_admin` (authenticated only).
    Trigger functions have no `REVOKE` (default `PUBLIC` execute remains —
    F-A06; harmless bodies, but G1 explicitly revokes `handle_updated_at`).
11. **No G1 weakened.** PROVED. No `ALTER`/`DROP`/`REVOKE` on any G1 table,
    function, policy, or grant in this file (verified by full-file read + grep).
    Only shared-object touch is none (does not even reference `handle_updated_at`).

## Findings (detail in `06`)

- F-A01 High: suspended super-admin retains `is_super_admin() = true` (no
  `app_users.status='active'` join).
- F-A02 Medium: no DB-boundary admin gate for audit/cron writes; doc overstates
  DEFINER coverage; secret-scan app-only.
- F-A03 Medium: `is_super_admin()` read path unused (no policy consumes it);
  header comment misleading; super-admin reads require service-role.
- F-A04 Medium: `TRUNCATE` bypasses append-only/no-delete triggers.
- F-A05 Low: first-admin bootstrap path undocumented.
- F-A06 Low: trigger functions lack `search_path=''` + explicit revokes.
- F-A07 Low: cron data-quality gaps (timestamps, error_summary gating, indexes).

## Verdict on this migration

**NOT ACCEPTED.** Fix F-A01 at minimum; address F-A02/F-A04 procedurally or in
SQL; apply hardening F-A06. Re-review before any apply.
