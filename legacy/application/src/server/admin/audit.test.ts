import { describe, it, expect, vi, beforeEach } from "vitest";

// Code-level tests for audit helper — validates guard, validation, and safety.
// Real DB insert would require Supabase integration environment.

const mockRequireSuperAdmin = vi.fn();
const mockInsert = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/lib/auth/require-super-admin", () => ({
  requireSuperAdmin: (...args: unknown[]) => mockRequireSuperAdmin(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn((payload: unknown) => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => {
            mockInsert(payload);
            return mockSelect();
          }),
        })),
      })),
    })),
  })),
}));

import { recordAdminAudit } from "./audit";

describe("recordAdminAudit — server audit helper", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires super admin — anonymous/non-admin cannot audit (delegates to requireSuperAdmin)", async () => {
    const { forbiddenError } = await import("@/lib/errors");
    mockRequireSuperAdmin.mockRejectedValue(forbiddenError("Super admin access required"));
    await expect(recordAdminAudit({ action: "organization.suspend", targetType: "organization", targetId: "00000000-0000-0000-0000-000000000000" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects invalid action format (must be resource.action)", async () => {
    mockRequireSuperAdmin.mockResolvedValue({ id: "actor-1" });
    await expect(recordAdminAudit({ action: "bad-action", targetType: "organization" })).rejects.toThrow(/Invalid action/);
    await expect(recordAdminAudit({ action: "Bad.Action", targetType: "organization" })).rejects.toThrow();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("accepts valid resource.action and writes via service_role", async () => {
    mockRequireSuperAdmin.mockResolvedValue({ id: "actor-1" });
    mockSelect.mockResolvedValue({ data: { id: "audit-1" }, error: null });
    const res = await recordAdminAudit({
      action: "entitlement.grant",
      targetType: "entitlement",
      targetId: "00000000-0000-0000-0000-000000000001",
      organizationId: "00000000-0000-0000-0000-000000000002",
      reason: "manual promo",
      before: { tool: "sponsor-sentinel", expires_at: null },
      after: { tool: "sponsor-sentinel", expires_at: "2026-12-01T00:00:00Z" },
    });
    expect(res).toEqual({ id: "audit-1" });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_user_id: "actor-1",
        action: "entitlement.grant",
        target_type: "entitlement",
      }),
    );
  });

  it("NEVER stores forbidden keys (password, tokens, secrets)", async () => {
    mockRequireSuperAdmin.mockResolvedValue({ id: "actor-1" });
    await expect(
      recordAdminAudit({ action: "user.disable", targetType: "user", before: { password: "secret" } as never }),
    ).rejects.toThrow(/forbidden key/i);
    await expect(
      recordAdminAudit({ action: "user.disable", targetType: "user", after: { access_token: "tok" } as never }),
    ).rejects.toThrow(/forbidden key/i);
    await expect(
      recordAdminAudit({ action: "billing.webhook_retry", targetType: "webhook", after: { razorpay_signature: "sig" } as never }),
    ).rejects.toThrow(/forbidden key/i);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("truncates reason to 500 chars", async () => {
    mockRequireSuperAdmin.mockResolvedValue({ id: "actor-1" });
    mockSelect.mockResolvedValue({ data: { id: "audit-2" }, error: null });
    const long = "a".repeat(600);
    await recordAdminAudit({ action: "organization.suspend", targetType: "organization", reason: long });
    const payload = mockInsert.mock.calls[0]?.[0] as { reason: string };
    expect(payload.reason.length).toBe(500);
  });

  it("is server-only — file does not import NEXT_PUBLIC or client localStorage", async () => {
    const fs = await import("node:fs");
    const content = fs.readFileSync("src/server/admin/audit.ts", "utf8");
    expect(content).not.toMatch(/NEXT_PUBLIC/);
    expect(content).not.toMatch(/localStorage/);
    expect(content).toContain("createAdminClient");
    expect(content).toContain("requireSuperAdmin");
  });
});
