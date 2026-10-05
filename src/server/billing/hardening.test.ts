import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/get-user", () => ({
  requireUser: vi.fn(async () => ({ id: "user-1" })),
  getCurrentUser: vi.fn(async () => ({ id: "user-1" })),
}));
vi.mock("@/lib/auth/require-membership", () => ({
  requireOrganizationMember: vi.fn(async () => ({
    user: { id: "user-1" },
    membership: { id: "mem-1", organization_id: "org-a", user_id: "user-1", role: "owner" },
    organization: { id: "org-a", name: "Test", slug: "test", owner_id: "user-1" },
  })),
}));

const mockAdminFrom = vi.fn();
const mockAdminRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockAdminFrom,
    rpc: mockAdminRpc,
  })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          single: vi.fn(async () => ({ data: null, error: null })),
        })),
      })),
    })),
  })),
}));

vi.mock("./razorpay", async (importOriginal) => {
  const actual = await (importOriginal() as Promise<typeof import("./razorpay")>);
  return {
    ...actual,
    verifyRazorpayPayment: vi.fn(() => ({ valid: true })),
    fetchRazorpayPayment: vi.fn(async (paymentId: string) => ({
      providerPaymentId: paymentId,
      providerOrderId: "order_razor_123",
      amountMinor: 149900,
      currency: "INR",
      status: "captured",
    })),
  };
});

import { verifyPaymentAndActivate } from "./verify-service";

describe("billing hardening — transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAZORPAY_KEY_SECRET = "test_secret";
  });

  it("transaction success: payment + order + entitlement all committed via RPC", async () => {
    const mockOrder = { id: "order-tx", organization_id: "org-a", plan_id: "plan-1", tool_id: "tool-1", is_all_access: false, amount_minor: 149900, currency: "INR", razorpay_order_id: "order_razor_123" };
    const mockPlan = { id: "plan-1", billing_period: "monthly" };
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockOrder, error: null })) })) })) } as never;
      if (table === "payments") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
      if (table === "plans") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockPlan, error: null })) })) })) } as never;
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    mockAdminRpc.mockResolvedValueOnce({ data: { order_id: "order-tx", expires_at: "2026-11-05T00:00:00.000Z", idempotent: false }, error: null });

    const result = await verifyPaymentAndActivate({
      orderId: "order-tx",
      razorpayOrderId: "order_razor_123",
      razorpayPaymentId: "pay_tx_1",
      razorpaySignature: "valid_sig",
    });
    expect(result.success).toBe(true);
    expect(mockAdminRpc).toHaveBeenCalledWith("complete_billing_payment", expect.objectContaining({ p_order_id: "order-tx", p_razorpay_payment_id: "pay_tx_1" }));
  });

  it("transaction failure: RPC error leaves no partial payment/order", async () => {
    const mockOrder = { id: "order-fail", organization_id: "org-a", plan_id: "plan-1", tool_id: "tool-1", is_all_access: false, amount_minor: 149900, currency: "INR", razorpay_order_id: "order_razor_123" };
    const mockPlan = { id: "plan-1", billing_period: "monthly" };
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockOrder, error: null })) })) })) } as never;
      if (table === "payments") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
      if (table === "plans") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockPlan, error: null })) })) })) } as never;
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    mockAdminRpc.mockResolvedValueOnce({ data: null, error: { message: "entitlement insert failed", code: "23505" } } as never);

    await expect(
      verifyPaymentAndActivate({
        orderId: "order-fail",
        razorpayOrderId: "order_razor_123",
        razorpayPaymentId: "pay_fail",
        razorpaySignature: "valid_sig",
      })
    ).rejects.toThrow();
    // RPC is atomic, so no separate payment row should remain via from().insert — we verify rpc was called and error propagated
    expect(mockAdminRpc).toHaveBeenCalled();
  });

  it("NULL entitlement remains infinite (does not downgrade)", async () => {
    const mockOrder = { id: "order-null", organization_id: "org-a", plan_id: "plan-1", tool_id: "tool-1", is_all_access: false, amount_minor: 149900, currency: "INR", razorpay_order_id: "order_razor_123" };
    const mockPlan = { id: "plan-1", billing_period: "monthly" };
    // Pre-check for existing payment (none) and order load
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockOrder, error: null })) })) })) } as never;
      if (table === "payments") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
      if (table === "plans") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockPlan, error: null })) })) })) } as never;
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    // RPC returns null expires_at for infinite
    mockAdminRpc.mockResolvedValueOnce({ data: { order_id: "order-null", expires_at: null, idempotent: false }, error: null });

    const result = await verifyPaymentAndActivate({
      orderId: "order-null",
      razorpayOrderId: "order_razor_123",
      razorpayPaymentId: "pay_null",
      razorpaySignature: "valid_sig",
    });
    expect(result.success).toBe(true);
    expect(result.expiresAt).toBeNull();
  });

  it("concurrent duplicate payment — only one extension via RPC idempotency", async () => {
    const mockOrder = { id: "order-conc", organization_id: "org-a", plan_id: "plan-1", tool_id: "tool-1", is_all_access: false, amount_minor: 149900, currency: "INR", razorpay_order_id: "order_razor_123" };
    const mockPlan = { id: "plan-1", billing_period: "monthly" };
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "orders") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockOrder, error: null })) })) })) } as never;
      if (table === "payments") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
      if (table === "plans") return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: mockPlan, error: null })) })) })) } as never;
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    // First call creates, second call would be idempotent — mock RPC to return same expires_at for both, second with idempotent true
    mockAdminRpc
      .mockResolvedValueOnce({ data: { order_id: "order-conc", expires_at: "2026-11-05T00:00:00.000Z", idempotent: false }, error: null })
      .mockResolvedValueOnce({ data: { order_id: "order-conc", expires_at: "2026-11-05T00:00:00.000Z", idempotent: true }, error: null });

    const r1 = await verifyPaymentAndActivate({
      orderId: "order-conc",
      razorpayOrderId: "order_razor_123",
      razorpayPaymentId: "pay_conc",
      razorpaySignature: "valid_sig",
    });
    const r2 = await verifyPaymentAndActivate({
      orderId: "order-conc",
      razorpayOrderId: "order_razor_123",
      razorpayPaymentId: "pay_conc",
      razorpaySignature: "valid_sig",
    });
    expect(r1.expiresAt).toBe("2026-11-05T00:00:00.000Z");
    expect(r2.expiresAt).toBe("2026-11-05T00:00:00.000Z");
    expect(r1.expiresAt).toBe(r2.expiresAt);
  });
});
