// Admin/audit boundary — STATIC review tests (no live PostgreSQL).
// Assert on the active 24-migration ledger after P14 D1→D3 cutover.
// Historical `20261112000003_d1_security_remediation.sql` is archived and must
// remain outside supabase/migrations (see team-security-boundary A6).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findForbiddenAuditKey } from "./audit";

const root = process.cwd();
const MIG1 = readFileSync(
  path.join(root, "supabase/migrations/20261112000001_d1_admin_foundation.sql"),
  "utf8",
);
const MIG_ADMIN = readFileSync(
  path.join(root, "supabase/migrations/20261112000002_p14_admin_superadmin_active_gate.sql"),
  "utf8",
);

describe("A6 archival — D1 security remediation stays out of active chain", () => {
  it("does not keep archived 20261112000003 in supabase/migrations", () => {
    expect(
      existsSync(
        path.join(root, "supabase/migrations/20261112000003_d1_security_remediation.sql"),
      ),
    ).toBe(false);
  });
});

describe("F-A01 suspended admin fails authorization (static)", () => {
  it("is_super_admin joins active app_users and fails closed", () => {
    expect(MIG_ADMIN).toMatch(/create or replace function public\.is_super_admin\(\)/);
    expect(MIG_ADMIN).toContain("join public.app_users as au on au.id = pa.user_id");
    expect(MIG_ADMIN).toContain("au.status = 'active'");
    expect(MIG_ADMIN).toContain("pa.user_id = auth.uid()");
  });
  it("grants stay least-privilege (authenticated execute only)", () => {
    expect(MIG_ADMIN).toContain("revoke all on function public.is_super_admin() from public");
    expect(MIG_ADMIN).toContain("grant execute on function public.is_super_admin() to authenticated");
  });
  it("no caller-controlled user-id parameter exists", () => {
    expect(MIG_ADMIN).not.toMatch(/is_super_admin\([^)]*p_user/);
    expect(MIG1).not.toMatch(/is_super_admin\([^)]*p_user/);
  });
});

describe("admin audit/cron boundary clarification (static)", () => {
  it("no RLS write path or DEFINER audit writer is invented in the active gate migration", () => {
    expect(MIG_ADMIN.toLowerCase()).not.toContain("record_admin_audit");
    expect(MIG_ADMIN).not.toMatch(/create policy.*admin_audit_logs/);
    expect(MIG_ADMIN).not.toMatch(/create policy.*cron_run_ledger/);
  });
  it("trigger functions are hardened (search_path + revokes)", () => {
    for (const fn of [
      "prevent_admin_audit_mutation",
      "enforce_cron_run_ledger_lifecycle",
      "prevent_cron_ledger_delete",
    ]) {
      expect(MIG_ADMIN).toContain(`function public.${fn}()`);
    }
    expect(MIG_ADMIN).toContain("set search_path = ''");
    expect(MIG_ADMIN).toContain(
      "revoke all on function public.prevent_admin_audit_mutation() from authenticated",
    );
  });
  it("ordinary users cannot self-grant admin (no platform_admins policy)", () => {
    expect(MIG1).not.toMatch(/create policy.*platform_admins/);
    expect(MIG_ADMIN).not.toMatch(/create policy.*platform_admins/);
  });
  it("app-layer secret scan still guards audit metadata (unit)", () => {
    expect(findForbiddenAuditKey({ password_hash: "x" }, null)).toBe("password_hash");
    expect(findForbiddenAuditKey({ ok: 1 }, { nested: { service_role: 1 } })).toBe(
      "nested.service_role",
    );
    expect(findForbiddenAuditKey({ ok: 1 }, null)).toBeNull();
  });
});
