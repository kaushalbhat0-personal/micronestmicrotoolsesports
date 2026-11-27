# 03 — Admin, Audit & Operational Foundation (GATE D1.3)

## Sources inspected

- `ref/legacy-project/application/src/server/admin/platform-admins.ts` (grant/revoke, `revoke_platform_admin_atomic`, `UUID_RE`, reason gates)
- `.../server/admin/audit.ts` (`ACTION_RE`, `FORBIDDEN_KEYS`, `recordAdminAudit`) + `audit-log.ts` (`safeAuditProjection`)
- `.../server/cron/run-ledger.ts` (`recordCronRunStart/Complete`, `getCronLedgerSummaries`)
- `.../server/cron/cron-auth.ts` (`assertCronAuth`)
- Migrations `20251014000001_platform_admin_foundation`, `20251014000002_admin_audit_append_only`, `20251107000001_cron_run_ledger`, `20251108000001_superadmin_v1_03_hardening`

## Fresh security design (D1)

- **Authorization:** session-derived only. `is_super_admin()` (`SECURITY DEFINER`, `auth.uid()` membership check, `authenticated` execute only). App layer: `requireSuperAdmin` (future server op) → admin client. No caller-supplied identity, no user-ID args.
- **Least privilege:** `platform_admins` default-deny (no anon/authenticated table policies). `admin_audit_logs` / `cron_run_ledger` default-deny; writes via DEFINER helpers or service-role after app auth. No service-role in browser code.
- **Append-only:** `prevent_admin_audit_mutation()` (no UPDATE/DELETE any role) + `enforce_cron_run_ledger_lifecycle()` (INSERT must be `running` + no `completed_at`; UPDATE only `running→succeeded|failed` + immutable ids + `completed_at`; DELETE rejected).
- **Secrets:** app-layer forbidden-key scan (password/secret/token/session/hash/api_key/service_role/signature) preserved in `src/server/admin/audit.ts`; DB checks action regex + target length.
- **Separation:** platform admin (`is_super_admin`) ≠ organization membership (`is_team_captain`). No shared helper; no org table in D1.

## Minimum implemented in D1

- `src/server/admin/audit.ts`: `isValidAdminAction`, `isValidTargetType`, `requireAdminReason`, `isUuid`, `findForbiddenAuditKey`, `projectAuditValue/Record`, `isValidCronJobId/RunId` + `audit.test.ts` (6 tests). Pure, no DB.
- Migration `supabase/migrations/20261112000001_d1_admin_foundation.sql` (local, NOT applied): `platform_admins`, `is_super_admin()`, `admin_audit_logs` + trigger, `cron_run_ledger` + triggers, RLS enable + revoke-all, `is_super_admin` grant. Pending acceptance.

## Explicitly not built

No admin dashboard, no grant/revoke server ops, no audit viewer, no cron routes, no org audit logs. Those require the accepted DB + session-op layer (next phase).

## Acceptance

Pure primitives PASS. DB pending security review (see `06`, `09`).
