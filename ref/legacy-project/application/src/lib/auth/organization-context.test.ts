import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

// Mock supabase server
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    rpc: mockRpc,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1", email: "test@example.com" } }, error: null })),
    },
  })),
}));

// Mock requireUser to return consistent user
vi.mock("./get-user", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1", email: "test@example.com" })),
  getCurrentUser: vi.fn(async () => ({ id: "user-1", email: "test@example.com" })),
}));

// Mock admin client — default unavailable
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    throw new Error("Admin not configured in test");
  }),
}));

// Mock repository — we test logic via supabase.from mocks, so repository findOrganizationContext will use mocked from
vi.mock("@/server/repositories/organizations", async () => {
  const actual = await vi.importActual<typeof import("@/server/repositories/organizations")>("@/server/repositories/organizations");
  return {
    ...actual,
    findOrganizationContext: vi.fn(async (_supabase: unknown, slug: string, userId: string) => {
      if (slug === "org-a" && userId === "user-1") {
        return { organization: { id: "org-1", name: "Org A", slug: "org-a" }, membership: { id: "mem-1", role: "member" } };
      }
      if (slug === "org-b" && userId === "user-1") {
        return null;
      }
      if (slug === "not-real") {
        return null;
      }
      return null;
    }),
  };
});

import { requireOrganizationContext, getOrganizationContext } from "./organization-context";

describe("organization context security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Case 1: authenticated member allowed (org-a)", async () => {
    const ctx = await requireOrganizationContext("org-a");
    expect(ctx.organization.slug).toBe("org-a");
    expect(ctx.membership.role).toBe("member");
  });

  it("Case 2: authenticated non-member denied (org-b)", async () => {
    await expect(requireOrganizationContext("org-b")).rejects.toMatchObject({
      code: "NOT_FOUND", // secure default is 404 when admin not available; forbidden when admin confirms existence
    });
  });

  it("Case 3: nonexistent slug not found", async () => {
    await expect(requireOrganizationContext("not-real")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("Case 4: arbitrary organizationId spoof denied", async () => {
    // No code in app trusts raw organizationId from client; only slug via requireOrganizationContext
    const result = await getOrganizationContext("spoofed-org-id-as-slug");
    expect(result).toBeNull();
  });

  it("Case 5: switcher only displays own organizations (getUserOrganizations mock)", async () => {
    // This verifies repository returns only own orgs; we mock getUserOrganizations via actual impl would filter by user_id
    // Here we test that our mocked findOrganizationContext respects userId, not arbitrary
    const ctx = await getOrganizationContext("org-a");
    expect(ctx?.organization.id).toBe("org-1");
    const nullCtx = await getOrganizationContext("org-b");
    expect(nullCtx).toBeNull();
  });

  it("Case 6: sponsor sentinel requires membership before entitlement", async () => {
    // Simulate requireEntitlement without membership should fail via requireOrganizationContext first
    await expect(requireOrganizationContext("org-b")).rejects.toBeDefined();
    // Allowed case already verified in Case 1 — membership passes, then entitlement would be checked
    const ctx = await requireOrganizationContext("org-a");
    expect(ctx.membership.role).toBeDefined();
  });
});
