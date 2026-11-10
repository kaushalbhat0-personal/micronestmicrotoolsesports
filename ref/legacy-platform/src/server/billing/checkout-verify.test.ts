import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@/lib/auth/get-user", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1", email: "test@example.com" })),
  getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
}));
vi.mock("@/lib/auth/require-membership", () => ({
  requireOrganizationMember: vi.fn(async (orgId: string) => {
    if (orgId === "org-b") throw Object.assign(new Error("not member"), { code: "FORBIDDEN", status: 403 });
    return { user: { id: "user-1" }, membership: { id: "mem-1", organization_id: orgId, user_id: "user-1", role: "owner" }, organization: { id: orgId, name: "Test Org", slug: "test-org", owner_id: "user-1" } };
  }),
  requireOrganizationRole: vi.fn(async (orgId: string, roles: string[]) => {
    const ctx = { user: { id: "user-1" }, membership: { id: "mem-1", organization_id: orgId, user_id: "user-1", role: "owner" }, organization: { id: orgId, name: "Test Org", slug: "test-org", owner_id: "user-1" } };
    if (orgId === "org-b") throw Object.assign(new Error("not member"), { code: "FORBIDDEN", status: 403 });
    if (!roles.includes(ctx.membership.role)) throw Object.assign(new Error("forbidden"), { code: "FORBIDDEN", status: 403 });
    return ctx;
  }),
}));

// Mock supabase
const mockAdminFrom = vi.fn();
const mockAdminRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn((_table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          single: vi.fn(async () => ({ data: null, error: { message: "not found" } })),
        })),
        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      })),
    })),
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockAdminFrom,
    rpc: mockAdminRpc,
  })),
}));

// Mock dodo adapter (active provider)
vi.mock("./dodo", async (importOriginal) => {
  const actual = await (importOriginal() as Promise<typeof import("./dodo")>);
  return {
    ...actual,
    createDodoCheckoutSession: vi.fn(async (input: { amountMinor: number; currency: string; orderId: string }) => ({
      sessionId: "cks_dodo_" + input.orderId,
      checkoutUrl: "https://checkout.dodopayments.com/session/cks_dodo_" + input.orderId,
    })),
    validateDodoProduct: vi.fn(async () => ({ valid: true, productId: "pdt_mock" })),
  };
});

// Keep razorpay adapter mock — verify-service (dormant Razorpay path) still imports it
vi.mock("./razorpay", async (importOriginal) => {
  const actual = await (importOriginal() as Promise<typeof import("./razorpay")>);
  return {
    ...actual,
    verifyRazorpayPayment: vi.fn(({ signature }: { signature: string }) => ({ valid: signature === "valid_sig" })),
    fetchRazorpayPayment: vi.fn(async (paymentId: string) => ({
      providerPaymentId: paymentId,
      providerOrderId: "order_razor_123",
      amountMinor: 149900,
      currency: "INR",
      status: "captured",
    })),
  };
});

// Mock dodo integration config so checkout doesn't require real env validation
vi.mock("@/server/integrations/dodo/client", async (importOriginal) => {
  const actual = await (importOriginal() as Promise<typeof import("@/server/integrations/dodo/client")>);
  return {
    ...actual,
    getDodoConfig: vi.fn(() => ({ apiKey: "dodo_test_key", environment: "test_mode", returnUrl: "https://example.com/billing/return" })),
    getDodoProductIdForPlanSlug: vi.fn((slug: string) => `pdt_micro_${slug.replace(/-/g, "_")}`),
  };
});

import { createCheckoutOrder } from "./checkout-service";
import { verifyPaymentAndActivate } from "./verify-service";

function mockPlanRow(plan: Record<string, unknown>) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: plan, error: null })),
        single: vi.fn(async () => ({ data: plan, error: null })),
      })),
    })),
  } as never;
}

describe("billing checkout — server-authoritative", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DODO_PAYMENTS_API_KEY = "dodo_test_key";
    process.env.DODO_PAYMENTS_ENVIRONMENT = "test_mode";
  });

  it("creates order with server snapshot, not client amount", async () => {
    const mockInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: "order-1" }, error: null })),
      })),
    }));
    const mockUpdate = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          insert: mockInsert,
          update: mockUpdate,
          select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "order-1", organization_id: "org-a", plan_id: "plan-1", amount_minor: 149900, currency: "INR", provider: "dodo", dodo_session_id: "cks_dodo_order-1", is_all_access: false, tool_id: "tool-1" }, error: null })) })) })),
        } as never;
      }
      if (table === "plans") {
        return mockPlanRow({ id: "plan-1", tool_id: "tool-1", billing_period: "monthly", amount_minor: 149900, currency: "INR", is_active: true, slug: "sponsorship-tracking-monthly" }) as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });

    const result = await createCheckoutOrder({ planId: "plan-1", organizationId: "org-a" });
    expect(result.amountMinor).toBe(149900);
    expect(result.currency).toBe("INR");
    expect(result.orderId).toBe("order-1");
    expect(result.provider).toBe("dodo");
    expect(result.checkoutUrl).toContain("https://checkout.dodopayments.com/session/");
    expect(result.dodoSessionId).toBe("cks_dodo_order-1");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ amount_minor: 149900, currency: "INR", tool_id: "tool-1", is_all_access: false, provider: "dodo" })
    );
  });

  it("rejects inactive plan", async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "plans") {
        return mockPlanRow({ id: "plan-inactive", tool_id: "tool-1", billing_period: "monthly", amount_minor: 149900, currency: "INR", is_active: false }) as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    await expect(createCheckoutOrder({ planId: "plan-inactive", organizationId: "org-a" })).rejects.toThrow();
  });

  it("price tampering — client amount ignored, server plan wins", async () => {
    const mockInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: "order-1" }, error: null })),
      })),
    }));
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") return { insert: mockInsert, update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) } as never;
      if (table === "plans") {
        return mockPlanRow({ id: "plan-prize-monthly", tool_id: "tool-prize", billing_period: "monthly", amount_minor: 69900, currency: "INR", is_active: true, slug: "prize-pool-splitter-monthly" }) as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    const result = await createCheckoutOrder({ planId: "plan-prize-monthly", organizationId: "org-a" });
    expect(result.amountMinor).toBe(69900);
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ amount_minor: 69900 }));
  });

  it("cross-tenant checkout rejected", async () => {
    await expect(createCheckoutOrder({ planId: "plan-1", organizationId: "org-b" })).rejects.toThrow();
  });

  it("member role cannot create paid checkout (owner/admin only)", async () => {
    const { requireOrganizationRole } = await import("@/lib/auth/require-membership");
    vi.mocked(requireOrganizationRole).mockRejectedValueOnce(
      Object.assign(new Error("Requires role: owner | admin"), { code: "FORBIDDEN", status: 403 }),
    );
    const insertSpy = vi.fn();
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") return { insert: insertSpy } as never;
      if (table === "plans") {
        return mockPlanRow({ id: "plan-1", tool_id: "tool-1", billing_period: "monthly", amount_minor: 149900, currency: "INR", is_active: true, slug: "sponsorship-tracking-monthly" }) as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    await expect(createCheckoutOrder({ planId: "plan-1", organizationId: "org-a" })).rejects.toThrow(/owner | admin/);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("dodo session failure marks order failed", async () => {
    const mockInsert = vi.fn(() => ({
      select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "order-fail" }, error: null })) })),
    }));
    const mockUpdate = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") return { insert: mockInsert, update: mockUpdate } as never;
      if (table === "plans") {
        return mockPlanRow({ id: "plan-1", tool_id: "tool-1", billing_period: "monthly", amount_minor: 149900, currency: "INR", is_active: true, slug: "sponsorship-tracking-monthly" }) as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    const { createDodoCheckoutSession } = await import("./dodo");
    (createDodoCheckoutSession as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Dodo down"));
    await expect(createCheckoutOrder({ planId: "plan-1", organizationId: "org-a" })).rejects.toThrow("Dodo down");
    expect(mockUpdate).toHaveBeenCalledWith({ status: "failed" });
  });

  it("fail-fast when Dodo not configured — no order created", async () => {
    const { getDodoConfig } = await import("@/server/integrations/dodo/client");
    (getDodoConfig as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    // Also need to ensure no client double provided
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "plans") {
        return mockPlanRow({ id: "plan-1", tool_id: "tool-1", billing_period: "monthly", amount_minor: 149900, currency: "INR", is_active: true }) as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    const insertSpy = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "should-not-create" }, error: null })) })) }));
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") return { insert: insertSpy, update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) } as never;
      if (table === "plans") return mockPlanRow({ id: "plan-1", tool_id: "tool-1", billing_period: "monthly", amount_minor: 149900, currency: "INR", is_active: true }) as never;
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    await expect(createCheckoutOrder({ planId: "plan-1", organizationId: "org-a" })).rejects.toThrow("Payment not configured");
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("fail-fast when plan has no Dodo product — no order created", async () => {
    const { getDodoProductIdForPlanSlug } = await import("@/server/integrations/dodo/client");
    (getDodoProductIdForPlanSlug as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    const insertSpy = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "should-not-create" }, error: null })) })) }));
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") return { insert: insertSpy, update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) } as never;
      if (table === "plans") return mockPlanRow({ id: "plan-1", tool_id: "tool-1", billing_period: "monthly", amount_minor: 149900, currency: "INR", is_active: true, slug: "unmapped-plan" }) as never;
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    await expect(createCheckoutOrder({ planId: "plan-1", organizationId: "org-a" })).rejects.toThrow("Payment not configured for this plan");
    expect(insertSpy).not.toHaveBeenCalled();
  });
});

describe("billing verify — payment verification", () => {
  it("valid payment activates entitlement with correct expiry", async () => {
    const now = new Date("2026-10-05T00:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const mockOrder = { id: "order-1", organization_id: "org-a", plan_id: "plan-1", tool_id: "tool-1", is_all_access: false, amount_minor: 149900, currency: "INR", razorpay_order_id: "order_razor_123", status: "created" };
    const mockPlan = { id: "plan-1", billing_period: "monthly" };
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockOrder, error: null })) })),
          })),
        } as never;
      }
      if (table === "payments") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })),
        } as never;
      }
      if (table === "plans") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockPlan, error: null })) })) })) } as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    mockAdminRpc.mockResolvedValueOnce({ data: { expires_at: "2026-11-05T00:00:00.000Z" }, error: null });

    const result = await verifyPaymentAndActivate({
      orderId: "order-1",
      razorpayOrderId: "order_razor_123",
      razorpayPaymentId: "pay_123",
      razorpaySignature: "valid_sig",
    });
    expect(result.success).toBe(true);
    expect(result.orderId).toBe("order-1");
    expect(new Date(result.expiresAt as string).toISOString().slice(0, 10)).toBe("2026-11-05");

    vi.useRealTimers();
  });

  it("duplicate payment idempotent — no second expiry extension (valid sig)", async () => {
    const mockOrder = { id: "order-1", organization_id: "org-a", plan_id: "plan-1", tool_id: "tool-1", is_all_access: false, amount_minor: 149900, currency: "INR", razorpay_order_id: "order_razor_123" };
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockOrder, error: null })) })) })) } as never;
      }
      if (table === "payments") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { id: "pay-existing", status: "captured" }, error: null })) })),
          })),
        } as never;
      }
      if (table === "tool_entitlements") {
        // verify-service now does single scoped query; mock accordingly
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string) => {
              if (col === "organization_id") {
                return {
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: { expires_at: "2026-11-05T00:00:00.000Z" }, error: null })),
                  })),
                } as never;
              }
              return { eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) } as never;
            }),
          })),
        } as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });

    const result = await verifyPaymentAndActivate({
      orderId: "order-1",
      razorpayOrderId: "order_razor_123",
      razorpayPaymentId: "pay_existing",
      razorpaySignature: "valid_sig",
    });
    expect(result.success).toBe(true);
    expect(result.expiresAt).toBe("2026-11-05T00:00:00.000Z");
  });

  it("duplicate payment + invalid signature must reject (security invariant)", async () => {
    const mockOrder = { id: "order-1", organization_id: "org-a", plan_id: "plan-1", tool_id: "tool-1", is_all_access: false, amount_minor: 149900, currency: "INR", razorpay_order_id: "order_razor_123" };
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockOrder, error: null })) })) })) } as never;
      }
      if (table === "payments") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { id: "pay-existing", status: "captured" }, error: null })) })),
          })),
        } as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    await expect(
      verifyPaymentAndActivate({
        orderId: "order-1",
        razorpayOrderId: "order_razor_123",
        razorpayPaymentId: "pay_existing",
        razorpaySignature: "invalid_sig",
      })
    ).rejects.toThrow("Invalid payment signature");
  });

  it("cross-tenant verify rejected", async () => {
    const mockOrder = { id: "order-1", organization_id: "org-b", plan_id: "plan-1", tool_id: "tool-1", is_all_access: false, amount_minor: 149900, currency: "INR", razorpay_order_id: "order_razor_123" };
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockOrder, error: null })) })) })) } as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    await expect(
      verifyPaymentAndActivate({
        orderId: "order-1",
        razorpayOrderId: "order_razor_123",
        razorpayPaymentId: "pay_1",
        razorpaySignature: "valid_sig",
      })
    ).rejects.toThrow();
  });

  it("member role cannot verify/complete payment (owner/admin only)", async () => {
    const { requireOrganizationRole } = await import("@/lib/auth/require-membership");
    mockAdminRpc.mockClear();
    vi.mocked(requireOrganizationRole).mockRejectedValueOnce(
      Object.assign(new Error("Requires role: owner | admin"), { code: "FORBIDDEN", status: 403 }),
    );
    const mockOrder = { id: "order-1", organization_id: "org-a", plan_id: "plan-1", tool_id: "tool-1", is_all_access: false, amount_minor: 149900, currency: "INR", razorpay_order_id: "order_razor_123" };
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockOrder, error: null })) })) })) } as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    await expect(
      verifyPaymentAndActivate({
        orderId: "order-1",
        razorpayOrderId: "order_razor_123",
        razorpayPaymentId: "pay_1",
        razorpaySignature: "valid_sig",
      })
    ).rejects.toThrow(/owner | admin/);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("amount mismatch rejected", async () => {
    const mockOrder = { id: "order-1", organization_id: "org-a", plan_id: "plan-1", tool_id: "tool-1", is_all_access: false, amount_minor: 149900, currency: "INR", razorpay_order_id: "order_razor_123" };
    const mockPlan = { id: "plan-1", billing_period: "monthly" };
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockOrder, error: null })) })) })) } as never;
      }
      if (table === "payments") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
      }
      if (table === "plans") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockPlan, error: null })) })) })) } as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    const { fetchRazorpayPayment } = await import("./razorpay");
    (fetchRazorpayPayment as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      providerPaymentId: "pay_1",
      providerOrderId: "order_razor_123",
      amountMinor: 1,
      currency: "INR",
      status: "captured",
    });
    await expect(
      verifyPaymentAndActivate({
        orderId: "order-1",
        razorpayOrderId: "order_razor_123",
        razorpayPaymentId: "pay_1",
        razorpaySignature: "valid_sig",
      })
    ).rejects.toThrow("amount mismatch");
  });

  it("currency mismatch rejected", async () => {
    const mockOrder = { id: "order-1", organization_id: "org-a", plan_id: "plan-1", tool_id: "tool-1", is_all_access: false, amount_minor: 149900, currency: "INR", razorpay_order_id: "order_razor_123" };
    const mockPlan = { id: "plan-1", billing_period: "monthly" };
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockOrder, error: null })) })) })) } as never;
      if (table === "payments") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
      if (table === "plans") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockPlan, error: null })) })) })) } as never;
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    const { fetchRazorpayPayment } = await import("./razorpay");
    (fetchRazorpayPayment as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      providerPaymentId: "pay_1",
      providerOrderId: "order_razor_123",
      amountMinor: 149900,
      currency: "USD",
      status: "captured",
    });
    await expect(
      verifyPaymentAndActivate({
        orderId: "order-1",
        razorpayOrderId: "order_razor_123",
        razorpayPaymentId: "pay_1",
        razorpaySignature: "valid_sig",
      })
    ).rejects.toThrow("currency mismatch");
  });

  it("Razorpay order mismatch rejected", async () => {
    const mockOrder = { id: "order-1", organization_id: "org-a", plan_id: "plan-1", tool_id: "tool-1", is_all_access: false, amount_minor: 149900, currency: "INR", razorpay_order_id: "order_razor_123" };
    const mockPlan = { id: "plan-1", billing_period: "monthly" };
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockOrder, error: null })) })) })) } as never;
      if (table === "payments") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
      if (table === "plans") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockPlan, error: null })) })) })) } as never;
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    const { fetchRazorpayPayment } = await import("./razorpay");
    (fetchRazorpayPayment as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      providerPaymentId: "pay_1",
      providerOrderId: "order_razor_OTHER",
      amountMinor: 149900,
      currency: "INR",
      status: "captured",
    });
    await expect(
      verifyPaymentAndActivate({
        orderId: "order-1",
        razorpayOrderId: "order_razor_123",
        razorpayPaymentId: "pay_1",
        razorpaySignature: "valid_sig",
      })
    ).rejects.toThrow("order mismatch");
  });

  it("All Access entitlement created correctly", async () => {
    const mockOrder = { id: "order-all", organization_id: "org-a", plan_id: "plan-all-monthly", tool_id: null, is_all_access: true, amount_minor: 249900, currency: "INR", razorpay_order_id: "order_razor_all" };
    const mockPlan = { id: "plan-all-monthly", billing_period: "monthly" };
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockOrder, error: null })) })) })) } as never;
      }
      if (table === "payments") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
      }
      if (table === "plans") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockPlan, error: null })) })) })) } as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    mockAdminRpc.mockResolvedValueOnce({ data: { expires_at: new Date().toISOString() }, error: null });
    const { fetchRazorpayPayment } = await import("./razorpay");
    (fetchRazorpayPayment as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      providerPaymentId: "pay_all",
      providerOrderId: "order_razor_all",
      amountMinor: 249900,
      currency: "INR",
      status: "captured",
    });
    const result = await verifyPaymentAndActivate({
      orderId: "order-all",
      razorpayOrderId: "order_razor_all",
      razorpayPaymentId: "pay_all",
      razorpaySignature: "valid_sig",
    });
    expect(result.success).toBe(true);
    expect(mockAdminRpc).toHaveBeenCalledWith("complete_billing_payment", expect.objectContaining({ p_order_id: "order-all" }));
  });

  it("23505 race — scoped entitlement for tool purchase (not all-access)", async () => {
    const mockOrder = { id: "order-tool", organization_id: "org-a", plan_id: "plan-tool-monthly", tool_id: "tool-1", is_all_access: false, amount_minor: 69900, currency: "INR", razorpay_order_id: "order_razor_tool" };
    const mockPlan = { id: "plan-tool-monthly", billing_period: "monthly" };
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockOrder, error: null })) })) })) } as never;
      if (table === "payments") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
      if (table === "plans") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockPlan, error: null })) })) })) } as never;
      if (table === "tool_entitlements") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, _val: unknown) => {
              // Capture scoped query — ensure tool_id = tool-1 and is_all_access false
              if (col === "organization_id") {
                return {
                  eq: vi.fn((c2: string, v2: unknown) => {
                    if (c2 === "tool_id" && v2 === "tool-1") {
                      return { eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { expires_at: "2026-11-05T00:00:00.000Z" }, error: null })) })) } as never;
                    }
                    if (c2 === "is_all_access") {
                      return { maybeSingle: vi.fn(async () => ({ data: { expires_at: "2026-11-05T00:00:00.000Z" }, error: null })) } as never;
                    }
                    return { maybeSingle: vi.fn(async () => ({ data: null, error: null })) } as never;
                  }),
                } as never;
              }
              return { eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) } as never;
            }),
          })),
        } as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    const { fetchRazorpayPayment } = await import("./razorpay");
    (fetchRazorpayPayment as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      providerPaymentId: "pay_tool_dup",
      providerOrderId: "order_razor_tool",
      amountMinor: 69900,
      currency: "INR",
      status: "captured",
    });
    // Simulate RPC unique violation
    mockAdminRpc.mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate key value" } } as never);

    // Re-mock for actual call: need to handle both parallel fetch and fallback
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockOrder, error: null })) })) })) } as never;
      if (table === "payments") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
      if (table === "plans") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockPlan, error: null })) })) })) } as never;
      if (table === "tool_entitlements") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: { expires_at: "2026-11-05T00:00:00.000Z" }, error: null })),
                })),
              })),
            })),
          })),
        } as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });

    const result = await verifyPaymentAndActivate({
      orderId: "order-tool",
      razorpayOrderId: "order_razor_tool",
      razorpayPaymentId: "pay_tool_dup",
      razorpaySignature: "valid_sig",
    });
    expect(result.success).toBe(true);
    expect(result.expiresAt).toBe("2026-11-05T00:00:00.000Z");
  });
});
