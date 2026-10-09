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
const PAST = new Date(Date.now() - 86400000).toISOString();
const SPONSOR_TOOL_ID = "tool-sponsor-id";

function memberOf(orgId: string) {
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

/** Chainable mock: terminals single/maybeSingle/list per table. */
function setupDb(opts: {
  rpcAccess: boolean;
  userGrant?: { expires_at: string | null; source?: string } | null;
  orgGrantRows?: Array<{ expires_at: string | null }>;
  memberOrgs?: string[];
}) {
  const calls: Array<{ table: string; op: string }> = [];
  mockRpc.mockResolvedValue({ data: opts.rpcAccess, error: null });
  mockFrom.mockImplementation((table: string) => {
    const self: Record<string, unknown> = {};
    const terminal = () => {
      if (table === "tools") return Promise.resolve({ data: { id: SPONSOR_TOOL_ID, slug: "sponsor-sentinel", is_active: true }, error: null });
      if (table === "organization_members") {
        // Access-level resolver re-verifies membership from the DB.
        return Promise.resolve({ data: { id: "m1" }, error: null });
      }
      if (table === "user_tool_entitlements") {
        calls.push({ table, op: "read" });
        return Promise.resolve({ data: opts.userGrant ?? null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    };
    self.select = () => self;
    self.eq = () => self;
    self.order = () => self;
    self.limit = () => self;
    self.or = () => self;
    self.insert = (...args: unknown[]) => {
      calls.push({ table, op: "insert" });
      void args;
      return self;
    };
    self.delete = (...args: unknown[]) => {
      calls.push({ table, op: "delete" });
      void args;
      return self;
    };
    self.single = terminal;
    self.maybeSingle = terminal;
    self.then = (resolve: (v: unknown) => void) => {
      // Awaited directly (list queries): organization grant rows.
      if (table === "tool_entitlements") resolve({ data: opts.orgGrantRows ?? [], error: null });
      else resolve({ data: null, error: null });
    };
    return self;
  });
  return calls;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sponsor-sentinel with user grants", () => {
  it("1. member with valid user grant is allowed in Organization A (no org grant)", async () => {
    memberOf("org-a1");
    const calls = setupDb({ rpcAccess: false, userGrant: { expires_at: FUTURE, source: "subscription" } });
    const result = await requireEntitlement("org-a1", "sponsor-sentinel");
    expect(result.hasAccess).toBe(true);
    expect(calls.some((c) => c.table === "user_tool_entitlements")).toBe(true);
  });

  it("2. same user is allowed in Organization B where they are a member", async () => {
    memberOf("org-b2");
    setupDb({ rpcAccess: false, userGrant: { expires_at: FUTURE, source: "subscription" } });
    const result = await requireEntitlement("org-b2", "sponsor-sentinel");
    expect(result.hasAccess).toBe(true);
  });

  it("9. existing organization grant still allows without any user grant", async () => {
    memberOf("org-a9");
    const calls = setupDb({ rpcAccess: true, userGrant: null });
    const result = await requireEntitlement("org-a9", "sponsor-sentinel");
    expect(result.hasAccess).toBe(true);
    // Org-grant path returns before the user-grant table is consulted.
    expect(calls.some((c) => c.table === "user_tool_entitlements")).toBe(false);
  });

  it("4. expired user grant denies when no org grant exists", async () => {
    memberOf("org-a4");
    setupDb({ rpcAccess: false, userGrant: { expires_at: PAST } });
    await expect(requireEntitlement("org-a4", "sponsor-sentinel")).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
  });

  it("no grants at all denies with the existing safe message", async () => {
    memberOf("org-a5");
    setupDb({ rpcAccess: false, userGrant: null });
    await expect(requireEntitlement("org-a5", "sponsor-sentinel")).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
  });

  it("10. an org-grant allow never writes a user grant", async () => {
    memberOf("org-a10");
    const calls = setupDb({ rpcAccess: true, userGrant: null });
    await requireEntitlement("org-a10", "sponsor-sentinel");
    expect(calls.every((c) => c.op === "read")).toBe(true);
    expect(mockFrom).not.toHaveBeenCalledWith("user_tool_entitlements");
  });

  it("11. organization grant stays organization-scoped (other org denied)", async () => {
    memberOf("org-b11");
    setupDb({ rpcAccess: false, userGrant: null });
    await expect(requireEntitlement("org-b11", "sponsor-sentinel")).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
  });
});

describe("operational tools never consult user grants", () => {
  it.each([
    ["12. draft-ban", "draft-ban"],
    ["13. tie-breaker", "tie-breaker"],
    ["14. prize-splitter", "prize-splitter"],
  ])("%s: valid user grant does NOT grant access without an org grant", async (_label, slug) => {
    memberOf(`org-${slug}-op`);
    setupDb({ rpcAccess: false, userGrant: { expires_at: FUTURE } });
    await expect(requireEntitlement(`org-${slug}-op`, slug)).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
    expect(mockFrom).not.toHaveBeenCalledWith("user_tool_entitlements");
  });

  it("16. operational resolution unchanged: org grant allows regardless of user grant", async () => {
    memberOf("org-a16");
    setupDb({ rpcAccess: true, userGrant: { expires_at: FUTURE } });
    const result = await requireEntitlement("org-a16", "draft-ban");
    expect(result.hasAccess).toBe(true);
  });

  it("17/18. all-access-style org grant in A does not leak into B", async () => {
    memberOf("org-b1718");
    setupDb({ rpcAccess: false, userGrant: null });
    await expect(requireEntitlement("org-b1718", "draft-ban")).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
    await expect(requireEntitlement("org-b1718", "sponsor-sentinel")).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
  });

  it("coming-soon tools never consult user grants", async () => {
    memberOf("org-soon");
    const calls = setupDb({ rpcAccess: false, userGrant: { expires_at: FUTURE } });
    await expect(requireEntitlement("org-soon", "scrim-matchmaker")).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
    expect(calls.some((c) => c.table === "user_tool_entitlements")).toBe(false);
  });
});

describe("expired paid grants fall back to Free (logical expiry → free)", () => {
  // NOTE: requireEntitlement is React-cache()d, so every case uses a distinct
  // org id to avoid cross-test cache hits.
  it.each([
    ["subscription", "org-x1a"],
    ["manual", "org-x1b"],
    ["promo", "org-x1c"],
  ])("expired %s user grant is allowed as Free", async (source, orgId) => {
    memberOf(orgId);
    setupDb({ rpcAccess: false, userGrant: { expires_at: PAST, source } });
    const result = await requireEntitlement(orgId, "sponsor-sentinel");
    expect(result.hasAccess).toBe(true);
  });

  it("expired grant of unknown source still denies (fail closed)", async () => {
    memberOf("org-x4");
    setupDb({ rpcAccess: false, userGrant: { expires_at: PAST } });
    await expect(requireEntitlement("org-x4", "sponsor-sentinel")).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
  });

  it("expired paid grant surfaces in slugs as Free access", async () => {
    memberOf("org-x5");
    setupDb({ rpcAccess: false, userGrant: { expires_at: PAST, source: "subscription" }, orgGrantRows: [] });
    const slugs = await getAccessibleToolSlugs("org-x5");
    expect(slugs).toContain("sponsor-sentinel");
  });
});

describe("getAccessibleToolSlugs with user grants", () => {
  it("adds sponsor-sentinel for members with a user grant but no org grant", async () => {
    memberOf("org-nav1");
    setupDb({ rpcAccess: false, userGrant: { expires_at: FUTURE, source: "subscription" }, orgGrantRows: [] });
    const slugs = await getAccessibleToolSlugs("org-nav1");
    expect(slugs).toContain("sponsor-sentinel");
  });

  it("never adds operational tools from a user grant", async () => {
    memberOf("org-nav2");
    setupDb({ rpcAccess: false, userGrant: { expires_at: FUTURE, source: "subscription" }, orgGrantRows: [] });
    const slugs = await getAccessibleToolSlugs("org-nav2");
    expect(slugs).toEqual(["sponsor-sentinel"]);
  });

  it("omits sponsor-sentinel when neither grant exists", async () => {
    memberOf("org-nav3");
    setupDb({ rpcAccess: false, userGrant: null, orgGrantRows: [] });
    const slugs = await getAccessibleToolSlugs("org-nav3");
    expect(slugs).not.toContain("sponsor-sentinel");
  });
});
