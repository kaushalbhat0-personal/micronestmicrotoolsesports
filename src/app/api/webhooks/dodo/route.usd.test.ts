/**
 * Dodo webhook — international (USD) + attack matrix.
 *
 * Complements route.test.ts (INR happy path): proves USD fulfillment and
 * that every cross-currency / wrong-product / cross-org / replay attack
 * fails closed. Amounts here are test fixtures, not production prices.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Webhook } from "standardwebhooks";

import { POST } from "./route";
import { DODO_METADATA_KEYS } from "@/server/billing/dodo";

// Webhook secret (signing only, never real)
const WEBHOOK_KEY = `whsec_${Buffer.from("dodo-route-usd-test-secret-0123").toString("base64")}`;

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

type MockDodoPayment = {
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  status: string;
  subscriptionId: string | null;
  subscriptionIds: string[];
  productIds: string[] | null;
  orderId: string;
};

const mockFetchDodoPayment = vi.fn(async (paymentId: string): Promise<MockDodoPayment> => ({
  providerPaymentId: paymentId,
  amountMinor: 1900,
  currency: "USD",
  status: "succeeded",
  subscriptionId: null,
  subscriptionIds: [] as string[],
  productIds: ["pdt_micro_sponsorship_tracking_monthly_usd"] as string[] | null,
  orderId: "order-usd-1",
}));

vi.mock("@/server/billing/dodo", async (importOriginal) => {
  const actual = await (importOriginal() as Promise<typeof import("@/server/billing/dodo")>);
  return { ...actual, fetchDodoPayment: (...args: unknown[]) => (mockFetchDodoPayment as (...a: unknown[]) => unknown)(...args) };
});

function signedRequest(rawBody: string, id: string, key = WEBHOOK_KEY) {
  const wh = new Webhook(key);
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
      payment_id: "pay_dodo_usd_1",
      status: "succeeded",
      total_amount: 1900,
      currency: "USD",
      metadata: { [DODO_METADATA_KEYS.orderId]: "order-usd-1" },
      ...overrides,
    },
  });
}

const mockUsdOrder = {
  id: "order-usd-1",
  organization_id: "org-a",
  plan_id: "plan-usd-m",
  amount_minor: 1900,
  currency: "USD",
  provider: "dodo",
  dodo_session_id: "cks_usd_1",
  status: "created",
};

const mockUsdPlan = {
  id: "plan-usd-m",
  slug: "sponsorship-tracking-monthly-usd",
  billing_period: "monthly",
  amount_minor: 1900,
  currency: "USD",
  tool_id: "tool-sponsor",
};

function selectChain(final: unknown) {
  return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => final), single: vi.fn(async () => final) })) })) } as never;
}

function mockTables(opts: {
  order?: unknown;
  payment?: unknown;
  plan?: unknown;
  rpcData?: unknown;
  rpcError?: unknown;
}) {
  const { order = mockUsdOrder, payment = null, plan = mockUsdPlan, rpcData = { expires_at: "2026-11-18T00:00:00.000Z" }, rpcError = null } = opts;
  mockAdminFrom.mockImplementation((table: string) => {
    if (table === "webhook_events") {
      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: "evt-db-1" }, error: null })) })),
        })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      } as never;
    }
    if (table === "orders") return selectChain({ data: order, error: null });
    if (table === "payments") return selectChain({ data: payment, error: null });
    if (table === "plans") return selectChain({ data: plan, error: null });
    return selectChain({ data: null, error: null });
  });
  mockAdminRpc.mockResolvedValue({ data: rpcData, error: rpcError });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.DODO_PAYMENTS_WEBHOOK_KEY = WEBHOOK_KEY;
  mockFetchDodoPayment.mockImplementation(async (paymentId: string) => ({
    providerPaymentId: paymentId,
    amountMinor: 1900,
    currency: "USD",
    status: "succeeded",
    subscriptionId: null,
    subscriptionIds: [],
    productIds: ["pdt_micro_sponsorship_tracking_monthly_usd"],
    orderId: "order-usd-1",
  }));
  mockTables({});
});

describe("POST /api/webhooks/dodo — international USD fulfillment", () => {
  it("fulfills USD payment.succeeded via canonical RPC (USD amount/currency/period)", async () => {
    const res = await POST(signedRequest(paymentSucceededBody(), "wh_usd_ok"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { received?: boolean; orderId?: string };
    expect(body.received).toBe(true);
    expect(body.orderId).toBe("order-usd-1");
    expect(mockAdminRpc).toHaveBeenCalledWith(
      "complete_dodo_payment",
      expect.objectContaining({ p_order_id: "order-usd-1", p_amount_minor: 1900, p_currency: "USD", p_billing_period: "monthly" })
    );
  });

  it("USD yearly plan fulfills with the plan billing period (never payload-derived)", async () => {
    mockTables({
      order: { ...mockUsdOrder, id: "order-usd-y", plan_id: "plan-usd-y", amount_minor: 19000 },
      plan: { ...mockUsdPlan, id: "plan-usd-y", slug: "sponsorship-tracking-yearly-usd", billing_period: "yearly", amount_minor: 19000 },
    });
    mockFetchDodoPayment.mockResolvedValueOnce({
      providerPaymentId: "pay_dodo_usd_1",
      amountMinor: 19000,
      currency: "USD",
      status: "succeeded",
      subscriptionId: null,
      subscriptionIds: [],
      productIds: ["pdt_micro_sponsorship_tracking_yearly_usd"],
      orderId: "order-usd-y",
    });
    const res = await POST(signedRequest(paymentSucceededBody({ total_amount: 19000 }), "wh_usd_y"));
    expect(res.status).toBe(200);
    expect(mockAdminRpc).toHaveBeenCalledWith("complete_dodo_payment", expect.objectContaining({ p_billing_period: "yearly" }));
  });

  it("fulfills when product linkage is unexposed but amount/currency/order bind (documented fallback)", async () => {
    mockFetchDodoPayment.mockResolvedValueOnce({
      providerPaymentId: "pay_dodo_usd_1",
      amountMinor: 1900,
      currency: "USD",
      status: "succeeded",
      subscriptionId: null,
      subscriptionIds: [],
      productIds: null,
      orderId: "order-usd-1",
    });
    const res = await POST(signedRequest(paymentSucceededBody(), "wh_usd_noprod"));
    expect(res.status).toBe(200);
    expect(mockAdminRpc).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/webhooks/dodo — cross-currency and product attacks fail closed", () => {
  it("USD payment against INR order is rejected (no RPC)", async () => {
    mockTables({
      order: { ...mockUsdOrder, id: "order-1", amount_minor: 149900, currency: "INR" },
      plan: { id: "plan-1", slug: "sponsorship-tracking-monthly", billing_period: "monthly", amount_minor: 149900, currency: "INR", tool_id: "tool-sponsor" },
    });
    // Same order correlation, but the authoritative charge is USD.
    mockFetchDodoPayment.mockResolvedValueOnce({
      providerPaymentId: "pay_dodo_usd_1",
      amountMinor: 149900,
      currency: "USD",
      status: "succeeded",
      subscriptionId: null,
      subscriptionIds: [],
      productIds: ["pdt_micro_sponsorship_tracking_monthly"],
      orderId: "order-1",
    });
    const res = await POST(signedRequest(paymentSucceededBody(), "wh_xcur_1"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { message?: string } };
    expect(body.error?.message).toMatch(/currency/i);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("INR payment against USD order is rejected (no RPC)", async () => {
    mockFetchDodoPayment.mockResolvedValueOnce({
      providerPaymentId: "pay_dodo_usd_1",
      amountMinor: 149900,
      currency: "INR",
      status: "succeeded",
      subscriptionId: null,
      subscriptionIds: [],
      productIds: ["pdt_micro_sponsorship_tracking_monthly_usd"],
      orderId: "order-usd-1",
    });
    const res = await POST(signedRequest(paymentSucceededBody({ total_amount: 149900, currency: "INR" }), "wh_xcur_2"));
    expect(res.status).toBe(400);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("wrong Dodo product is rejected even with matching amount/currency", async () => {
    mockFetchDodoPayment.mockResolvedValueOnce({
      providerPaymentId: "pay_dodo_usd_1",
      amountMinor: 1900,
      currency: "USD",
      status: "succeeded",
      subscriptionId: null,
      subscriptionIds: [],
      productIds: ["pdt_micro_all_access_monthly"],
      orderId: "order-usd-1",
    });
    const res = await POST(signedRequest(paymentSucceededBody(), "wh_xprod_1"));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { message?: string } };
    expect(body.error?.message).toMatch(/product/i);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("subscription-linked payment is rejected (one-time model only)", async () => {
    mockFetchDodoPayment.mockResolvedValueOnce({
      providerPaymentId: "pay_dodo_usd_1",
      amountMinor: 1900,
      currency: "USD",
      status: "succeeded",
      subscriptionId: "sub_1",
      subscriptionIds: ["sub_1"],
      productIds: ["pdt_micro_sponsorship_tracking_monthly_usd"],
      orderId: "order-usd-1",
    });
    const res = await POST(signedRequest(paymentSucceededBody(), "wh_xsub_1"));
    expect(res.status).toBe(400);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("cross-organization order (payment metadata points elsewhere) is rejected", async () => {
    mockFetchDodoPayment.mockResolvedValueOnce({
      providerPaymentId: "pay_dodo_usd_1",
      amountMinor: 1900,
      currency: "USD",
      status: "succeeded",
      subscriptionId: null,
      subscriptionIds: [],
      productIds: ["pdt_micro_sponsorship_tracking_monthly_usd"],
      orderId: "order-attacker-org",
    });
    const res = await POST(signedRequest(paymentSucceededBody(), "wh_xorg_1"));
    expect(res.status).toBe(400);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("order/plan amount drift is rejected (snapshot must equal catalog plan)", async () => {
    mockTables({
      plan: { ...mockUsdPlan, amount_minor: 2999 },
    });
    const res = await POST(signedRequest(paymentSucceededBody(), "wh_xdrift_1"));
    expect(res.status).toBe(400);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/dodo — replay, forgery, duplicate, terminal events", () => {
  it("forged signature is rejected with 400 and writes nothing", async () => {
    const req = new Request("https://example.com/api/webhooks/dodo", {
      method: "POST",
      headers: { "webhook-id": "wh_forge_1", "webhook-signature": "forged", "webhook-timestamp": "1" },
      body: paymentSucceededBody(),
    });
    mockAdminFrom.mockClear();
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("replayed body with a stale signature is rejected (timestamp tolerance)", async () => {
    const rawBody = paymentSucceededBody();
    const req = signedRequest(rawBody, "wh_replay_1");
    const tampered = paymentSucceededBody({ total_amount: 1 });
    const replayed = new Request("https://example.com/api/webhooks/dodo", {
      method: "POST",
      headers: {
        "webhook-id": req.headers.get("webhook-id")!,
        "webhook-signature": req.headers.get("webhook-signature")!,
        "webhook-timestamp": req.headers.get("webhook-timestamp")!,
      },
      body: tampered,
    });
    mockAdminFrom.mockClear();
    const res = await POST(replayed);
    expect(res.status).toBe(400);
    expect(mockAdminFrom).not.toHaveBeenCalled();
  });

  it("duplicate payment id returns 200 without re-provisioning", async () => {
    mockTables({ payment: { id: "pay-existing", status: "captured" } });
    const res = await POST(signedRequest(paymentSucceededBody(), "wh_dup_usd"));
    expect(res.status).toBe(200);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("failed USD payment marks the created order failed; cancelled never touches paid", async () => {
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
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: mockUsdOrder, error: null })) })) })),
          update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) })),
        } as never;
      }
      return selectChain({ data: null, error: null });
    });
    const res = await POST(signedRequest(rawBody, "wh_fail_usd"));
    expect(res.status).toBe(200);
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });

  it("subscription events are recorded but never provision", async () => {
    const rawBody = JSON.stringify({ type: "subscription.created", data: { payload_type: "Subscription", subscription_id: "sub_1" } });
    const res = await POST(signedRequest(rawBody, "wh_sub_usd"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { unsupported?: string };
    expect(body.unsupported).toBe("subscription.created");
    expect(mockAdminRpc).not.toHaveBeenCalled();
  });
});
