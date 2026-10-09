import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Auth mocks: authenticated purchaser user-1; member of every org except org-stranger ──
vi.mock("@/lib/auth/get-user", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1", email: "buyer@example.com" })),
  getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
}));
vi.mock("@/lib/auth/require-membership", () => ({
  requireOrganizationMember: vi.fn(async (orgId: string) => {
    if (orgId === "org-stranger") throw Object.assign(new Error("not member"), { code: "FORBIDDEN", status: 403 });
    return { user: { id: "user-1" }, membership: { id: "mem-1", organization_id: orgId, user_id: "user-1", role: "owner" }, organization: { id: orgId } };
  }),
}));

// ── Supabase mocks ──
const mockAdminFrom = vi.fn();
const mockAdminRpc = vi.fn();
const mockUserFrom = vi.fn();
const mockUserRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mockUserFrom, rpc: mockUserRpc })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom, rpc: mockAdminRpc })),
}));

// ── Razorpay mocks ──
vi.mock("./razorpay", async (importOriginal) => {
  const actual = await (importOriginal() as Promise<typeof import("./razorpay")>);
  return {
    ...actual,
    createRazorpayOrder: vi.fn(async (input: { amountMinor: number; currency: string; receipt: string }) => ({
      providerOrderId: "order_razor_" + input.receipt,
      amountMinor: input.amountMinor,
      currency: input.currency,
      status: "created",
      receipt: input.receipt,
    })),
  };
});
vi.mock("@/server/integrations/razorpay/client", async (importOriginal) => {
  const actual = await (importOriginal() as Promise<typeof import("@/server/integrations/razorpay/client")>);
  return {
    ...actual,
    getRazorpayConfig: vi.fn(() => ({ keyId: "rzp_test_123", keySecret: "test_secret", webhookSecret: "test_webhook_secret" })),
  };
});

import { createCheckoutOrder } from "./checkout-service";
import { requireEntitlement } from "@/lib/auth/require-entitlement";

const FUTURE = new Date(Date.now() + 86400000 * 30).toISOString();
const PAST = new Date(Date.now() - 86400000).toISOString();
const SPONSOR_TOOL_ID = "tool-sponsor-id";

function planRow(plan: Record<string, unknown>) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: plan, error: null })),
        single: vi.fn(async () => ({ data: plan, error: null })),
      })),
    })),
  } as never;
}

/** Capture the orders insert payload for a given plan. */
function captureOrderInsert(plan: Record<string, unknown>) {
  const captured: Record<string, unknown> = {};
  const mockInsert = vi.fn((payload: Record<string, unknown>) => {
    Object.assign(captured, payload);
    return { select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "order-1" }, error: null })) })) };
  });
  mockAdminFrom.mockImplementation((table: string) => {
    if (table === "orders") {
      return { insert: mockInsert, update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) } as never;
    }
    if (table === "plans") return planRow(plan) as never;
    return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
  });
  return captured;
}

/** Mock user-scoped DB for requireEntitlement: no org grant, given user grant. */
function mockUserGrantAccess(userGrant: { expires_at: string | null; source?: string } | null) {
  mockUserRpc.mockResolvedValue({ data: false, error: null });
  mockUserFrom.mockImplementation((table: string) => {
    const self: Record<string, unknown> = {};
    const terminal = () => {
      if (table === "tools") return Promise.resolve({ data: { id: SPONSOR_TOOL_ID, slug: "sponsor-sentinel", is_active: true }, error: null });
      // Access-level resolver re-verifies membership from the DB.
      if (table === "organization_members") return Promise.resolve({ data: { id: "m1" }, error: null });
      if (table === "user_tool_entitlements") return Promise.resolve({ data: userGrant, error: null });
      return Promise.resolve({ data: null, error: null });
    };
    self.select = () => self;
    self.eq = () => self;
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
  process.env.RAZORPAY_KEY_ID = "rzp_test_123";
  process.env.RAZORPAY_KEY_SECRET = "test_secret";
});

describe("Phase 4 — buyer attribution at checkout", () => {
  const SPONSOR_PLAN = { id: "plan-1", tool_id: SPONSOR_TOOL_ID, billing_period: "monthly", amount_minor: 149900, currency: "INR", is_active: true, slug: "sponsorship-tracking-monthly" };

  it("1+3. sponsorship order persists buyer_user_id from the authenticated session", async () => {
    const captured = captureOrderInsert(SPONSOR_PLAN);
    await createCheckoutOrder({ planId: "plan-1", organizationId: "org-a" });
    expect(captured).toMatchObject({ organization_id: "org-a", plan_id: "plan-1", buyer_user_id: "user-1" });
  });

  it("4. operational order behavior unchanged (same shape, buyer recorded, no grant tables)", async () => {
    const captured = captureOrderInsert({ id: "plan-db", tool_id: "tool-draft", billing_period: "monthly", amount_minor: 9900, currency: "INR", is_active: true, slug: "draft-ban-monthly" });
    await createCheckoutOrder({ planId: "plan-db", organizationId: "org-a" });
    expect(captured).toMatchObject({ organization_id: "org-a", tool_id: "tool-draft", is_all_access: false, buyer_user_id: "user-1" });
    expect(mockAdminFrom).not.toHaveBeenCalledWith("user_tool_entitlements");
    expect(mockAdminFrom).not.toHaveBeenCalledWith("tool_entitlements");
  });

  it("5. All Access order unchanged (tool NULL, buyer recorded, no grant tables)", async () => {
    const captured = captureOrderInsert({ id: "plan-aa", tool_id: null, billing_period: "yearly", amount_minor: 999900, currency: "INR", is_active: true, slug: "all-access-yearly" });
    await createCheckoutOrder({ planId: "plan-aa", organizationId: "org-a" });
    expect(captured).toMatchObject({ tool_id: null, is_all_access: true, buyer_user_id: "user-1" });
    expect(mockAdminFrom).not.toHaveBeenCalledWith("user_tool_entitlements");
  });

  it("live-test checkout also records the buyer", async () => {
    const { createLiveTestCheckoutOrder } = await import("./live-test-service");
    const captured: Record<string, unknown> = {};
    process.env.BILLING_LIVE_TEST_ENABLED = "true";
    process.env.BILLING_LIVE_TEST_ORG_ID = "org-a";
    process.env.BILLING_LIVE_TEST_USER_EMAIL = "buyer@example.com";
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            Object.assign(captured, payload);
            return { select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "order-1" }, error: null })) })) };
          }),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
          select: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) })) })) })),
        } as never;
      }
      if (table === "plans") {
        return planRow({ ...SPONSOR_PLAN, id: "a1b2c3d4-1234-1234-1234-000000000001" }) as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    const res = await createLiveTestCheckoutOrder({ planId: "a1b2c3d4-1234-1234-1234-000000000001" });
    expect(res.isLiveTest).toBe(true);
    expect(captured).toMatchObject({ buyer_user_id: "user-1", is_live_test: true });
    delete process.env.BILLING_LIVE_TEST_ENABLED;
    delete process.env.BILLING_LIVE_TEST_ORG_ID;
    delete process.env.BILLING_LIVE_TEST_USER_EMAIL;
  });

  it("24. checkout never touches primary workspace or profiles", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/server/billing/checkout-service.ts"), "utf8");
    expect(src).not.toMatch(/primary_organization_id/);
    expect(src).not.toMatch(/from\("profiles"\)/);
  });
});

describe("Phase 4 — purchased grant access matrix (source=subscription semantics)", () => {
  it("7+9+10. purchased monthly grant + membership → allowed", async () => {
    mockUserGrantAccess({ expires_at: FUTURE, source: "subscription" });
    const result = await requireEntitlement("org-a", "sponsor-sentinel");
    expect(result.hasAccess).toBe(true);
  });

  it("12. lifetime purchased grant (NULL expiry) → allowed", async () => {
    mockUserGrantAccess({ expires_at: null, source: "subscription" });
    const result = await requireEntitlement("org-a", "sponsor-sentinel");
    expect(result.hasAccess).toBe(true);
  });

  it("15. expired purchased grant + no org grant → allowed as Free (logical expiry → free, FIX-06)", async () => {
    mockUserGrantAccess({ expires_at: PAST, source: "subscription" });
    const result = await requireEntitlement("org-a", "sponsor-sentinel");
    expect(result.hasAccess).toBe(true);
  });

  it("15b. expired grant of unknown source + no org grant → denied (fail closed)", async () => {
    mockUserGrantAccess({ expires_at: PAST });
    await expect(requireEntitlement("org-a", "sponsor-sentinel")).rejects.toMatchObject({ code: "ENTITLEMENT_REQUIRED" });
  });

  it("18+19+20. purchased grant follows membership: other member org allowed, stranger denied", async () => {
    mockUserGrantAccess({ expires_at: FUTURE, source: "subscription" });
    await expect(requireEntitlement("org-b", "sponsor-sentinel")).resolves.toMatchObject({ hasAccess: true });
    await expect(requireEntitlement("org-stranger", "sponsor-sentinel")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
