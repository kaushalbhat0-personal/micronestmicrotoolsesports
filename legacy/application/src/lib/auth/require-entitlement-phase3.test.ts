import { describe, expect, it, vi, beforeEach } from "vitest";

const mockRequireOrganizationMember = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mockFrom, rpc: mockRpc })),
}));

vi.mock("./require-membership", () => ({
  requireOrganizationMember: (...args: unknown[]) => mockRequireOrganizationMember(...args),
}));

import { requireEntitlement, getAccessibleToolSlugs } from "./require-entitlement";

const USER = { id: "user-1", email: "u@example.com" };
const FUTURE = new Date(Date.now() + 86400000).toISOString();
const SPONSOR_TOOL_ID = "tool-sponsor-id";

function memberOnlyOf(orgId: string) {
  mockRequireOrganizationMember.mockImplementation(async (id: string) => {
    if (id === orgId) {
      return { user: USER, membership: { id: "m1" }, organization: { id: orgId } };
    }
    const err = new Error("You are not a member of this organization") as Error & { code: string; status: number };
    err.code = "FORBIDDEN";
    err.status = 403;
    throw err;
  });
}

function setupDb(opts: { rpcAccess: boolean; userGrant?: { expires_at: string | null; source?: string } | null }) {
  mockRpc.mockResolvedValue({ data: opts.rpcAccess, error: null });
  mockFrom.mockImplementation((table: string) => {
    const self: Record<string, unknown> = {};
    const terminal = () => {
      if (table === "tools") return Promise.resolve({ data: { id: SPONSOR_TOOL_ID, slug: "sponsor-sentinel", is_active: true }, error: null });
      // Access-level resolver re-verifies membership from the DB.
      if (table === "organization_members") return Promise.resolve({ data: { id: "m1" }, error: null });
      if (table === "user_tool_entitlements") return Promise.resolve({ data: opts.userGrant ?? null, error: null });
      return Promise.resolve({ data: null, error: null });
    };
    self.select = () => self;
    self.eq = () => self;
    self.order = () => self;
    self.limit = () => self;
    self.or = () => self;
    self.single = terminal;
    self.maybeSingle = terminal;
    self.then = (resolve: (v: unknown) => void) => {
      if (table === "tool_entitlements") resolve({ data: [], error: null });
      else resolve({ data: null, error: null });
    };
    return self;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("phase 3 access resolution — RCCF-MULTI-SCOPE-IMPLEMENT-03", () => {
  it("SCENARIO A: new user, new org, no grant → Sponsorship denied", async () => {
    memberOnlyOf("org-fresh");
    setupDb({ rpcAccess: false, userGrant: null });
    await expect(requireEntitlement("org-fresh", "sponsor-sentinel")).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
  });

  it("SCENARIO B: grandfathered user creates/joins Org B (no org row) → allowed via user grant", async () => {
    memberOnlyOf("org-b-new");
    setupDb({ rpcAccess: false, userGrant: { expires_at: FUTURE, source: "manual" } });
    const result = await requireEntitlement("org-b-new", "sponsor-sentinel");
    expect(result.hasAccess).toBe(true);
  });

  it("lifetime user grant (NULL expiry) allows access in a new org", async () => {
    memberOnlyOf("org-b-life");
    setupDb({ rpcAccess: false, userGrant: { expires_at: null, source: "manual" } });
    const result = await requireEntitlement("org-b-life", "sponsor-sentinel");
    expect(result.hasAccess).toBe(true);
  });

  it("SCENARIO C: valid grant but NO membership in Org B → denied (no bypass)", async () => {
    memberOnlyOf("org-a-member");
    setupDb({ rpcAccess: false, userGrant: { expires_at: FUTURE } });
    await expect(requireEntitlement("org-b-stranger", "sponsor-sentinel")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("SCENARIO E: operational tool stays org-scoped for the same entitled user", async () => {
    memberOnlyOf("org-b-op");
    setupDb({ rpcAccess: false, userGrant: { expires_at: FUTURE } });
    await expect(requireEntitlement("org-b-op", "draft-ban")).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
  });

  it("new org shows Sponsorship in accessible slugs for entitled members", async () => {
    memberOnlyOf("org-b-nav");
    setupDb({ rpcAccess: false, userGrant: { expires_at: FUTURE, source: "manual" } });
    const slugs = await getAccessibleToolSlugs("org-b-nav");
    expect(slugs).toContain("sponsor-sentinel");
  });

  it("new org hides Sponsorship for non-entitled members", async () => {
    memberOnlyOf("org-fresh-nav");
    setupDb({ rpcAccess: false, userGrant: null });
    const slugs = await getAccessibleToolSlugs("org-fresh-nav");
    expect(slugs).not.toContain("sponsor-sentinel");
  });
});
