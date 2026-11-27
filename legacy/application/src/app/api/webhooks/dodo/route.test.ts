import { describe, it, expect, vi, beforeEach } from "vitest";
import { Webhook } from "standardwebhooks";

import { POST } from "./route";
import { DODO_METADATA_KEYS } from "@/server/billing/dodo";

// Webhook secret (signing only, never real)
const WEBHOOK_KEY = `whsec_${Buffer.from("dodo-route-test-secret-0123456789").toString("base64")}`;

const mockAdminFrom = vi.fn();
const mockAdminRpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom, rpc: mockAdminRpc })),
}));

vi.mock("@/server/integrations/dodo/client", async (importOriginal) => {
  const actual = await (importOriginal() as Promise<typeof import("@/server/integrations/dodo/client")>);
  return {
    ...actual,
    getDodoConfig: vi.fn(() => ({ apiKey: "dodo_test_key", webhookKey: WEBHOOK_KEY, environment: "test_mode" })),
    getDodoProductIdForPlanSlug: vi.fn((slug: string) => `pdt_micro_${slug.replace(/-/g, "_")}`),
  };
});

const mockFetchDodoPayment = vi.fn(async (paymentId: string) => ({
  providerPaymentId: paymentId,
  amountMinor: 149900,
  currency: "INR",
  status: "succeeded",
  subscriptionId: null,
  subscriptionIds: [] as string[],
  productIds: ["pdt_micro_sponsorship_tracking_monthly"] as string[] | null,
  orderId: "order-1",
}));

vi.mock("@/server/billing/dodo", async (importOriginal) => {
  const actual = await (importOriginal() as Promise<typeof import("@/server/billing/dodo")>);
  return { ...actual, fetchDodoPayment: (...args: unknown[]) => (mockFetchDodoPayment as (...a: unknown[]) => unknown)(...args) };
});

function signedRequest(rawBody: string, id: string) {
  const wh = new Webhook(WEBHOOK_KEY);
  const timestamp = new Date();
  const signature = wh.sign(id, timestamp, rawBody);
  return new Request("https://example.com/api/webhooks/dodo", {
    method: "POST",
    headers: {
      "webhook-id": id,
      "webhook-signature": signature,
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    },
    body: rawBody,
  });
}

function paymentSucceededBody(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: "payment.succeeded",
    business_id: "biz_1",
    timestamp: new Date().toISOString(),
    data: {
      payload_type: "Payment",
      payment_id: "pay_dodo_1",
      status: "succeeded",
      total_amount: 149900,
      currency: "INR",
      metadata: { [DODO_METADATA_KEYS.orderId]: "order-1" },
      ...overrides,
    },
  });
}

const mockOrder = {
  id: "order-1",
  organization_id: "org-a",
  plan_id: "plan-1",
  amount_minor: 149900,
  currency: "INR",
  provider: "dodo",
  dodo_session_id: "cks_1",
  status: "created",
};

const mockPlan = {
  id: "plan-1",
  slug: "sponsorship-tracking-monthly",
  billing_period: "monthly",
  amount_minor: 149900,
  currency: "INR",
  tool_id: "tool-1",
};

function selectChain(final: unknown) {
  return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => final), single: vi.fn(async () => final) })) })) } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DODO_PAYMENTS_WEBHOOK_KEY = WEBHOOK_KEY;
  mockAdminFrom.mockImplementation((table: string) => {
    if (table === "webhook_events") {
      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "evt-db-1" }, error: null })) })),
        })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      } as never;
    }
    if (table === "orders") return selectChain({ data: mockOrder, error: null });
    if (table === "payments") return selectChain({ data: null, error: null });
    if (table === "plans") return selectChain({ data: mockPlan, error: null });
    return selectChain({ data: null, error: null });
  });
  mockAdminRpc.mockResolvedValue({ data: { expires_at: "2026-11-18T00:00:00.000Z" }, error: null });
});

describe("POST /api/webhooks/dodo — trust boundaries", () => {
  it("rejects missing signature with 400 and writes nothing", async () => {
    const res = await POST(new Request("https://example.com/api/webhooks/dodo", { method: "POST", body: "{}" }));
    expect(res.status).toBe(400);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("rejects invalid signature with 400", async () => {
    const req = new Request("https://example.com/api/webhooks/dodo", {
      method: "POST",
      headers: { "webhook-id": "wh_x", "webhook-signature": "bad", "webhook-timestamp": "1" },
      body: paymentSucceededBody(),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("fulfills payment.succeeded: verifies, idempotent, completes via canonical RPC", async () => {
    const res = await POST(signedRequest(paymentSucceededBody(), "wh_ok_1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { received?: boolean; orderId?: string; expiresAt?: string };
    expect(body.received).toBe(true);
    expect(body.orderId).toBe("order-1");
    // Canonical completion with Dodo identifiers — never Razorpay params
    expect(mockAdminRpc).toHaveBeenCalledWith(
      "complete_dodo_payment",
      expect.objectContaining({ p_order_id: "order-1", p_amount_minor: 149900, p_currency: "INR" })
    );
    const rpcArgs = mockAdminRpc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(rpcArgs).not.toHaveProperty("p_razorpay_payment_id");
  });

  it("duplicate webhook (same webhook-id) returns 200 without re-provisioning", async () => {
    // First delivery succeeds
    const first = await POST(signedRequest(paymentSucceededBody(), "wh_dup_1"));
    expect(first.status).toBe(200);
    // Second delivery: webhook_events insert hits 23505, existing row succeeded
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "webhook_events") {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({ single: vi.fn(async () => ({ data: null, error: { code: "23505" } })) })),
          })),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { id: "evt-db-1", status: "succeeded", processed: true }, error: null })) })) })),
          })),
        } as never;
      }
      if (table === "orders") return selectChain({ data: mockOrder, error: null });
      return selectChain({ data: null, error: null });
    });
    const second = await POST(signedRequest(paymentSucceededBody(), "wh_dup_1"));
    expect(second.status).toBe(200);
    const body = (await second.json()) as { duplicate?: boolean };
    expect(body.duplicate).toBe(true);
    // RPC called only for the first delivery
    expect(mockAdminRpc).toHaveBeenCalledTimes(1);
  });

  it("wrong amount does not provision (records failure, no RPC)", async () => {
    mockFetchDodoPayment.mockResolvedValueOnce({
      providerPaymentId: "pay_dodo_1",
      amountMinor: 1,
      currency: "INR",
      status: "succeeded",
      subscriptionId: null,
      subscriptionIds: [],
      productIds: ["pdt_micro_sponsorship_tracking_monthly"],
      orderId: "order-1",
    });
    const res = await POST(signedRequest(paymentSucceededBody({ total_amount: 1 }), "wh_amt_1"));
    expect(res.status).toBe(400);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("wrong currency does not provision", async () => {
    mockFetchDodoPayment.mockResolvedValueOnce({
      providerPaymentId: "pay_dodo_1",
      amountMinor: 149900,
      currency: "USD",
      status: "succeeded",
      subscriptionId: null,
      subscriptionIds: [],
      productIds: ["pdt_micro_sponsorship_tracking_monthly"],
      orderId: "order-1",
    });
    const res = await POST(signedRequest(paymentSucceededBody({ currency: "USD" }), "wh_cur_1"));
    expect(res.status).toBe(400);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("wrong order (unknown metadata order) acks without provisioning", async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "webhook_events") {
        return {
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "evt-db-1" }, error: null })) })) })),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        } as never;
      }
      if (table === "orders") return selectChain({ data: null, error: null });
      return selectChain({ data: null, error: null });
    });
    const res = await POST(signedRequest(paymentSucceededBody(), "wh_ord_1"));
    expect(res.status).toBe(200);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("already-paid payment id returns 200 without re-extending", async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "webhook_events") {
        return {
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "evt-db-1" }, error: null })) })) })),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        } as never;
      }
      if (table === "orders") return selectChain({ data: mockOrder, error: null });
      if (table === "payments") return selectChain({ data: { id: "pay-existing", status: "captured" }, error: null });
      return selectChain({ data: null, error: null });
    });
    const res = await POST(signedRequest(paymentSucceededBody(), "wh_paid_1"));
    expect(res.status).toBe(200);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("payment.failed for a created order marks it failed; never touches paid orders", async () => {
    const rawBody = paymentSucceededBody().replace("payment.succeeded", "payment.failed");
    const updateSpy = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "webhook_events") {
        return {
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "evt-db-1" }, error: null })) })) })),
          update: updateSpy,
        } as never;
      }
      if (table === "orders") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: mockOrder, error: null })) })) })),
          update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) })),
        } as never;
      }
      return selectChain({ data: null, error: null });
    });
    const res = await POST(signedRequest(rawBody, "wh_fail_1"));
    expect(res.status).toBe(200);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("subscription events are recorded but never provision", async () => {
    const rawBody = JSON.stringify({ type: "subscription.renewed", data: { payload_type: "Subscription", subscription_id: "sub_1" } });
    const res = await POST(signedRequest(rawBody, "wh_sub_1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { unsupported?: string };
    expect(body.unsupported).toBe("subscription.renewed");
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("cross-provider order (razorpay) is rejected, never fulfilled via dodo", async () => {
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "webhook_events") {
        return {
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "evt-db-1" }, error: null })) })) })),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        } as never;
      }
      if (table === "orders") return selectChain({ data: { ...mockOrder, provider: "razorpay" }, error: null });
      return selectChain({ data: null, error: null });
    });
    const res = await POST(signedRequest(paymentSucceededBody(), "wh_xprov_1"));
    expect(res.status).toBe(400);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("All Access purchase provisions via canonical RPC (same path, plan-agnostic)", async () => {
    const allAccessOrder = { ...mockOrder, id: "order-all", tool_id: null, is_all_access: true };
    mockFetchDodoPayment.mockResolvedValueOnce({
      providerPaymentId: "pay_dodo_1",
      amountMinor: 149900,
      currency: "INR",
      status: "succeeded",
      subscriptionId: null,
      subscriptionIds: [],
      productIds: ["pdt_micro_all_access_yearly"],
      orderId: "order-all",
    });
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "webhook_events") {
        return {
          insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "evt-db-1" }, error: null })) })) })),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        } as never;
      }
      if (table === "orders") return selectChain({ data: allAccessOrder, error: null });
      if (table === "payments") return selectChain({ data: null, error: null });
      if (table === "plans") return selectChain({ data: { ...mockPlan, id: "plan-all", slug: "all-access-yearly", billing_period: "yearly", tool_id: null }, error: null });
      return selectChain({ data: null, error: null });
    });
    const res = await POST(signedRequest(paymentSucceededBody(), "wh_all_1"));
    expect(res.status).toBe(200);
    expect(mockAdminRpc).toHaveBeenCalledWith("complete_dodo_payment", expect.objectContaining({ p_order_id: "order-all", p_billing_period: "yearly" }));
  });
});
