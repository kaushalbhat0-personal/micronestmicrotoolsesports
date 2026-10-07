import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/auth/require-super-admin", () => ({
  requireSuperAdmin: vi.fn(async () => ({ id: "admin-1", email: "admin@example.com" })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

import { getAdminOverview } from "./overview";

function makeCountMock(count: number | null, error: unknown = null) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ select: vi.fn(() => ({ count, error })) })),
      or: vi.fn(() => ({ count, error })),
    })),
  } as unknown as ReturnType<typeof mockFrom>;
}

describe("getAdminOverview — read model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default setup: each table returns count
    mockFrom.mockImplementation((table: string) => {
      if (table === "organizations") {
        return { select: vi.fn(() => Promise.resolve({ count: 12, error: null })) } as never;
      }
      if (table === "profiles") {
        return { select: vi.fn(() => Promise.resolve({ count: 34, error: null })) } as never;
      }
      if (table === "tool_entitlements") {
        return {
          select: vi.fn(() => ({
            or: vi.fn(() => Promise.resolve({ count: 5, error: null })),
          })),
        } as never;
      }
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ count: 7, error: null })),
          })),
        } as never;
      }
      if (table === "payments") {
        return { select: vi.fn(() => Promise.resolve({ count: 9, error: null })) } as never;
      }
      if (table === "scans") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ count: 2, error: null })),
          })),
        } as never;
      }
      if (table === "admin_audit_logs") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        } as never;
      }
      return { select: vi.fn(() => Promise.resolve({ count: 0, error: null })) } as never;
    });
  });

  it("queries authoritative sources (organizations, profiles, entitlements, orders, payments, scans, audit)", async () => {
    await getAdminOverview();
    const tables = mockFrom.mock.calls.map((c) => c[0]);
    expect(tables).toContain("organizations");
    expect(tables).toContain("profiles");
    expect(tables).toContain("tool_entitlements");
    expect(tables).toContain("orders");
    expect(tables).toContain("payments");
    expect(tables).toContain("scans");
    expect(tables).toContain("admin_audit_logs");
  });

  it("uses count exact head true and preserves NULL entitlement semantics via or(is.null, gt now)", async () => {
    const content = readFileSync("src/server/admin/overview.ts", "utf8");
    expect(content).toContain('count: "exact"');
    expect(content).toContain("head: true");
    expect(content).toContain("expires_at.is.null");
    expect(content).toContain("expires_at.gt");
    expect(content).not.toContain("expires_at = null"); // should use is.null
  });

  it("does not treat failed query as zero — returns null + error", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "scans") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ count: null, error: { message: "db down" } })),
          })),
        } as never;
      }
      // other tables succeed
      return { select: vi.fn(() => Promise.resolve({ count: 1, error: null })) } as never;
    });
    // audit also needs mock
    const original = mockFrom;
    mockFrom.mockImplementation((table: string) => {
      if (table === "scans") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ count: null, error: { message: "db down" } })),
          })),
        } as never;
      }
      if (table === "admin_audit_logs") {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve({ data: [], error: null })) })),
          })),
        } as never;
      }
      return { select: vi.fn(() => Promise.resolve({ count: 1, error: null })) } as never;
    });

    const result = await getAdminOverview();
    expect(result.failedScans.count).toBeNull();
    expect(result.failedScans.error).toBe("Unavailable");
    expect(result.organizations.count).toBe(1); // other still succeeds
  });

  it("maps counts correctly — paid orders filter status=paid", async () => {
    const content = readFileSync("src/server/admin/overview.ts", "utf8");
    expect(content).toContain('.eq("status", "paid")');
    expect(content).toContain('.eq("status", "failed")');
  });

  it("recent audit reads latest 10, not before/after/IP", async () => {
    const content = readFileSync("src/server/admin/overview.ts", "utf8");
    expect(content).toContain(".limit(10)");
    expect(content).toContain("order(\"created_at\"");
    expect(content).toContain("id, action, target_type");
    expect(content).not.toContain("before");
    // actual column select should not include before/after/ip
    expect(content).not.toMatch(/select\([^)]*before/);
  });

  it("recent audit does not expose sensitive audit fields in overview", async () => {
    const pageContent = readFileSync("src/app/(admin)/admin/page.tsx", "utf8");
    // Should not render before/after JSON or IP in list items — only action/target/actor/reason/timestamp
    expect(pageContent).not.toMatch(/entry\.before/);
    expect(pageContent).not.toMatch(/entry\.after/);
    expect(pageContent).not.toMatch(/entry\.ip/);
    expect(pageContent).toContain("No admin activity yet");
    // Explanatory text mentions before/after but that's documentation, not data exposure
    expect(pageContent).toContain("no before/after JSON");
  });
});
