import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

const mockAdminFrom = vi.fn();
const mockAdminRpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockAdminFrom,
    rpc: mockAdminRpc,
  })),
}));

vi.mock("@/server/billing/razorpay", async (importOriginal) => {
  const actual = await (importOriginal() as Promise<typeof import("@/server/billing/razorpay")>);
  return {
    ...actual,
    verifyRazorpayWebhook: vi.fn(({ signature }: { signature: string }) => ({ valid: signature === "valid_webhook_sig" })),
    parseRazorpayWebhook: vi.fn((raw: string) => {
      try {
        const p = JSON.parse(raw);
        if (p.event === "payment.captured") {
          return {
            provider: "razorpay",
            externalEventId: `payment.captured:${p.payload.payment.entity.id}`,
            eventType: "payment.captured",
            providerOrderId: p.payload.payment.entity.order_id,
            providerPaymentId: p.payload.payment.entity.id,
            amountMinor: p.payload.payment.entity.amount,
            currency: p.payload.payment.entity.currency,
            paymentStatus: p.payload.payment.entity.status,
          };
        }
        if (p.event === "payment.authorized") {
          return {
            provider: "razorpay",
            externalEventId: `payment.authorized:${p.payload.payment.entity.id}`,
            eventType: "payment.authorized",
            providerOrderId: p.payload.payment.entity.order_id,
            providerPaymentId: p.payload.payment.entity.id,
            amountMinor: p.payload.payment.entity.amount,
            currency: p.payload.payment.entity.currency,
            paymentStatus: "authorized",
          };
        }
        return {
          provider: "razorpay",
          externalEventId: `unknown:${p.event}`,
          eventType: p.event,
          providerOrderId: null,
          providerPaymentId: null,
          amountMinor: null,
          currency: null,
          paymentStatus: null,
        };
      } catch {
        return null;
      }
    }),
    fetchRazorpayPayment: vi.fn(async (paymentId: string) => ({
      providerPaymentId: paymentId,
      providerOrderId: "order_razor_123",
      amountMinor: 149900,
      currency: "INR",
      status: "captured",
    })),
  };
});

import { POST } from "./route";

function makeRequest(rawBody: string, signature: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (signature !== null) headers["x-razorpay-signature"] = signature;
  return new Request("http://localhost/api/webhooks/razorpay", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

describe("POST /api/webhooks/razorpay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
  });

  it("valid signature + payment.captured → completes via RPC", async () => {
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_123", order_id: "order_razor_123", amount: 149900, currency: "INR", status: "captured" } } } });
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "webhook_events") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "evt-1" }, error: null })) })),
          })),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        } as never;
      }
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { id: "order-1", organization_id: "org-a", plan_id: "plan-1", amount_minor: 149900, currency: "INR", razorpay_order_id: "order_razor_123" }, error: null })) })),
          })),
        } as never;
      }
      if (table === "plans") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { billing_period: "monthly" }, error: null })) })) })) } as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    mockAdminRpc.mockResolvedValueOnce({ data: { order_id: "order-1", expires_at: "2026-11-05T00:00:00.000Z" }, error: null });

    const res = await POST(makeRequest(raw, "valid_webhook_sig"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
    expect(mockAdminRpc).toHaveBeenCalledWith("complete_billing_payment", expect.objectContaining({ p_order_id: "order-1" }));
  });

  it("invalid signature → 400, no DB", async () => {
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_123", order_id: "order_razor_123", amount: 149900, currency: "INR", status: "captured" } } } });
    const res = await POST(makeRequest(raw, "bad_sig"));
    expect(res.status).toBe(400);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("missing signature → 400", async () => {
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_123", order_id: "order_razor_123", amount: 149900, currency: "INR", status: "captured" } } } });
    const res = await POST(makeRequest(raw, null));
    expect(res.status).toBe(400);
  });

  it("malformed JSON → 400", async () => {
    const raw = "not json";
    const res = await POST(makeRequest(raw, "valid_webhook_sig"));
    expect(res.status).toBe(400);
  });

  it("unsupported event → 2xx without entitlement", async () => {
    const raw = JSON.stringify({ event: "order.paid", payload: {} });
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "webhook_events") {
        return {
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "evt-1" }, error: null })) })) })),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        } as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    const res = await POST(makeRequest(raw, "valid_webhook_sig"));
    expect(res.status).toBe(200);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("duplicate event → 200 idempotent (already succeeded)", async () => {
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_dup", order_id: "order_razor_123", amount: 149900, currency: "INR", status: "captured" } } } });
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "webhook_events") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: { code: "23505", message: "duplicate" } })) })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: { id: "evt-existing", status: "succeeded", processed: true }, error: null })),
              })),
            })),
          })),
        } as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    const res = await POST(makeRequest(raw, "valid_webhook_sig"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.duplicate).toBe(true);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("failed event retried → actually processes (not permanent duplicate)", async () => {
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_retry", order_id: "order_razor_123", amount: 149900, currency: "INR", status: "captured" } } } });
    let selectCallCount = 0;
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "webhook_events") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: { code: "23505", message: "duplicate" } })) })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => {
                  selectCallCount++;
                  if (selectCallCount === 1) {
                    return { data: { id: "evt-existing", status: "failed", processed: false }, error: null };
                  }
                  return { data: { id: "evt-existing", status: "succeeded", processed: true }, error: null };
                }),
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  select: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { id: "evt-existing" }, error: null })) })),
                })),
              })),
            })),
          })),
        } as never;
      }
      if (table === "orders") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { id: "order-1", organization_id: "org-a", plan_id: "plan-1", amount_minor: 149900, currency: "INR", razorpay_order_id: "order_razor_123" }, error: null })) })),
          })),
        } as never;
      }
      if (table === "plans") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { billing_period: "monthly" }, error: null })) })) })) } as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    mockAdminRpc.mockResolvedValueOnce({ data: { order_id: "order-1", expires_at: "2026-11-05T00:00:00.000Z" }, error: null });
    const res = await POST(makeRequest(raw, "valid_webhook_sig"));
    expect(res.status).toBe(200);
    expect(mockAdminRpc).toHaveBeenCalled();
  });

  it("order not found → 200 acknowledged, no entitlement", async () => {
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_x", order_id: "order_unknown", amount: 149900, currency: "INR", status: "captured" } } } });
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "webhook_events") {
        return {
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "evt-1" }, error: null })) })) })),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        } as never;
      }
      if (table === "orders") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    const res = await POST(makeRequest(raw, "valid_webhook_sig"));
    expect(res.status).toBe(200);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("amount mismatch → 400", async () => {
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_123", order_id: "order_razor_123", amount: 1, currency: "INR", status: "captured" } } } });
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "webhook_events") {
        return { insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "evt-1" }, error: null })) })) })), update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) } as never;
      }
      if (table === "orders") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { id: "order-1", organization_id: "org-a", plan_id: "plan-1", amount_minor: 149900, currency: "INR", razorpay_order_id: "order_razor_123" }, error: null })) })) })) } as never;
      }
      if (table === "plans") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { billing_period: "monthly" }, error: null })) })) })) } as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    const { fetchRazorpayPayment } = await import("@/server/billing/razorpay");
    (fetchRazorpayPayment as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      providerPaymentId: "pay_123",
      providerOrderId: "order_razor_123",
      amountMinor: 1,
      currency: "INR",
      status: "captured",
    });
    const res = await POST(makeRequest(raw, "valid_webhook_sig"));
    expect(res.status).toBe(400);
  });

  it("payment not captured (failed) → 200 without entitlement", async () => {
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_fail", order_id: "order_razor_123", amount: 149900, currency: "INR", status: "failed" } } } });
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "webhook_events") {
        return { insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "evt-1" }, error: null })) })) })), update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) } as never;
      }
      if (table === "orders") {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { id: "order-1", organization_id: "org-a", plan_id: "plan-1", amount_minor: 149900, currency: "INR", razorpay_order_id: "order_razor_123" }, error: null })) })) })) } as never;
      }
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })) } as never;
    });
    // Mock fetch to return failed
    const { fetchRazorpayPayment } = await import("@/server/billing/razorpay");
    (fetchRazorpayPayment as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      providerPaymentId: "pay_fail",
      providerOrderId: "order_razor_123",
      amountMinor: 149900,
      currency: "INR",
      status: "failed",
    });
    const res = await POST(makeRequest(raw, "valid_webhook_sig"));
    expect(res.status).toBe(200);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("missing webhook secret → 500", async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_123", order_id: "order_razor_123", amount: 149900, currency: "INR", status: "captured" } } } });
    const res = await POST(makeRequest(raw, "valid_webhook_sig"));
    expect(res.status).toBe(500);
    process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
  });
});
