import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/lib/auth/require-super-admin", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/server/admin/audit", () => ({
  recordAdminAudit: vi.fn(async () => ({ id: "audit-1" })),
}));

const ADMIN_A = "11111111-1111-4111-8111-111111111111";
const ADMIN_B = "22222222-2222-4222-8222-222222222222";

async function mockedAdmin() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  return vi.mocked(createAdminClient);
}

async function mockedAudit() {
  const { recordAdminAudit } = await import("@/server/admin/audit");
  return vi.mocked(recordAdminAudit);
}

function adminWithRpc(rpcImpl: () => Promise<{ data: unknown; error: unknown }>) {
  const rpc = vi.fn(rpcImpl);
  return {
    rpc,
    admin: {
      rpc,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: async () => ({ data: { id: "u1" }, error: null }) })),
          in: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
    },
  };
}

describe("Platform admin membership — RCCF-SUPERADMIN-V1-03", () => {
  beforeEach(() => vi.clearAllMocks());

  it("page and service are super-admin gated, service-role isolated from client", () => {
    expect(readFileSync("src/app/(admin)/admin/platform-admins/page.tsx", "utf8")).toContain("requireSuperAdmin");
    const svc = readFileSync("src/server/admin/platform-admins.ts", "utf8");
    expect(svc).toContain("requireSuperAdmin");
    expect(svc).toContain("createAdminClient");
    expect(svc.indexOf("requireSuperAdmin") < svc.indexOf("createAdminClient")).toBe(true);
    expect(readFileSync("src/components/admin/PlatformAdminForms.tsx", "utf8")).not.toContain("createAdminClient");
  });

  it("grant requires reason, prevents duplicates, audits", () => {
    const svc = readFileSync("src/server/admin/platform-admins.ts", "utf8");
    expect(svc).toContain("grantPlatformAdmin");
    expect(svc).toContain("requireReason");
    expect(svc).toContain("platform_admin.grant");
    expect(svc).toContain("23505");
    expect(svc).toContain("idempotent");
    expect(svc).not.toContain('from("auth.users")');
    expect(svc).not.toContain("NEXT_PUBLIC");
  });

  it("F-02: revoke is a single atomic RPC — no check-then-act sequence", () => {
    const svc = readFileSync("src/server/admin/platform-admins.ts", "utf8");
    expect(svc).toContain("revokePlatformAdmin");
    expect(svc).toContain("revoke_platform_admin_atomic");
    expect(svc).toContain("platform_admin.revoke");
    expect(svc).toContain("final_admin");
    expect(svc).toContain("not_found");
    // the racy count-then-delete sequence must be gone
    expect(svc).not.toContain('.delete()');
    expect(svc).not.toMatch(/count.*exact.*head/);
  });

  it("final admin cannot be revoked — RPC authoritative verdict", async () => {
    const { revokePlatformAdmin } = await import("./platform-admins");
    const recordAdminAudit = await mockedAudit();
    const { admin, rpc } = adminWithRpc(async () => ({ data: { ok: false, error: "final_admin" }, error: null }));
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    const res = await revokePlatformAdmin(ADMIN_A, "valid reason here");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("revoke_platform_admin_atomic", { p_target: ADMIN_A });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/final platform admin/i);
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });

  it("already-absent target behaves safely with no audit", async () => {
    const { revokePlatformAdmin } = await import("./platform-admins");
    const recordAdminAudit = await mockedAudit();
    const { admin, rpc } = adminWithRpc(async () => ({ data: { ok: false, error: "not_found" }, error: null }));
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    const res = await revokePlatformAdmin(ADMIN_B, "valid reason here");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/not found/i);
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });

  it("normal revoke of one of two admins succeeds with correct audit", async () => {
    const { revokePlatformAdmin } = await import("./platform-admins");
    const recordAdminAudit = await mockedAudit();
    const { admin, rpc } = adminWithRpc(async () => ({ data: { ok: true }, error: null }));
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    const res = await revokePlatformAdmin(ADMIN_A, "offboarding review done");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ ok: true });
    expect(recordAdminAudit).toHaveBeenCalledTimes(1);
    const arg = recordAdminAudit.mock.calls[0]?.[0] as unknown as {
      action: string;
      targetId: string;
      before: { isAdmin: boolean };
      after: { isAdmin: boolean };
    };
    expect(arg.action).toBe("platform_admin.revoke");
    expect(arg.targetId).toBe(ADMIN_A);
    expect(arg.before).toEqual({ isAdmin: true });
    expect(arg.after).toEqual({ isAdmin: false });
  });

  it("RPC transport failure is a safe rejection, never a silent removal", async () => {
    const { revokePlatformAdmin } = await import("./platform-admins");
    const recordAdminAudit = await mockedAudit();
    const { admin } = adminWithRpc(async () => ({ data: null, error: { message: "connection reset", code: "XX000" } }));
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    const res = await revokePlatformAdmin(ADMIN_A, "valid reason here");
    expect(res.ok).toBe(false);
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });

  it("unauthorized caller is rejected before any RPC", async () => {
    const { requireSuperAdmin } = await import("@/lib/auth/require-super-admin");
    vi.mocked(requireSuperAdmin).mockRejectedValueOnce(new Error("Forbidden"));
    const { revokePlatformAdmin } = await import("./platform-admins");
    const { admin, rpc } = adminWithRpc(async () => ({ data: { ok: true }, error: null }));
    (await mockedAdmin()).mockReturnValueOnce(admin as never);
    const res = await revokePlatformAdmin(ADMIN_A, "valid reason here");
    expect(res.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("invalid UUID and short reason are rejected server-side", async () => {
    const { revokePlatformAdmin } = await import("./platform-admins");
    const { admin, rpc } = adminWithRpc(async () => ({ data: { ok: true }, error: null }));
    const adminMock = await mockedAdmin();
    adminMock.mockReturnValueOnce(admin as never);
    const badId = await revokePlatformAdmin("not-a-uuid", "valid reason here");
    expect(badId.ok).toBe(false);
    adminMock.mockReturnValueOnce(admin as never);
    const badReason = await revokePlatformAdmin(ADMIN_A, "abc");
    expect(badReason.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("all mutations audited with safe before/after", () => {
    const svc = readFileSync("src/server/admin/platform-admins.ts", "utf8");
    expect(svc).toContain("recordAdminAudit");
    expect(svc).toContain("before: { isAdmin:");
    expect(svc).toContain("after: { isAdmin:");
  });

  it("no email/env bootstrap, no auto-promote", () => {
    const svc = readFileSync("src/server/admin/platform-admins.ts", "utf8");
    expect(svc).not.toMatch(/process\.env.*ADMIN/i);
    expect(svc).not.toMatch(/allowlist/i);
    expect(svc).toContain("Eligible existing user");
  });
});
