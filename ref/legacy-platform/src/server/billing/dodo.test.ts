import { describe, it, expect, vi, beforeEach } from "vitest";
import { Webhook } from "standardwebhooks";

import {
  createDodoCheckoutSession,
  verifyDodoWebhook,
  parseDodoWebhook,
  fetchDodoPayment,
  validateDodoProduct,
  DODO_METADATA_KEYS,
  type DodoClientLike,
} from "./dodo";
import { getDodoProductIdForPlanSlug } from "@/server/integrations/dodo/client";

function fakeClient(overrides?: Partial<DodoClientLike>): DodoClientLike {
  return {
    checkoutSessions: {
      create: vi.fn(async () => ({ session_id: "cks_test_1", checkout_url: "https://checkout.dodopayments.com/session/cks_test_1" })),
    },
    payments: {
      retrieve: vi.fn(async () => ({
        payment_id: "pay_test_1",
        status: "succeeded",
        total_amount: 149900,
        currency: "INR",
        subscription_id: null,
        subscription_ids: [],
        product_cart: [{ product_id: "pdt_sponsor_monthly" }],
        metadata: {
          [DODO_METADATA_KEYS.orderId]: "order-1",
          [DODO_METADATA_KEYS.organizationId]: "org-a",
          [DODO_METADATA_KEYS.planSlug]: "sponsorship-tracking-monthly",
        },
      })),
    },
    products: {
      retrieve: vi.fn(async (productId: string) => ({
        product_id: productId,
        is_recurring: false,
        price: { type: "one_time_price", currency: "INR", price: 149900 },
      })),
    },
    webhooks: {
      unwrap: vi.fn((body: string) => JSON.parse(body)),
    },
    ...overrides,
  };
}

const checkoutInput = {
  amountMinor: 149900,
  currency: "INR",
  productId: "pdt_sponsor_monthly",
  customerEmail: "buyer@example.com",
  orderId: "order-1",
  organizationId: "org-a",
  planSlug: "sponsorship-tracking-monthly",
  returnUrl: "https://example.com/billing/return?orderId=order-1",
};

describe("dodo adapter — checkout session construction", () => {
  it("builds a one-time INR session with server-derived fields and metadata", async () => {
    const client = fakeClient();
    const result = await createDodoCheckoutSession(checkoutInput, { client });
    expect(result.sessionId).toBe("cks_test_1");
    expect(result.checkoutUrl).toContain("checkout.dodopayments.com");
    const create = client.checkoutSessions.create as ReturnType<typeof vi.fn>;
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        product_cart: [{ product_id: "pdt_sponsor_monthly", quantity: 1 }],
        customer: { email: "buyer@example.com" },
        billing_address: { country: "IN" },
        billing_currency: "INR",
        metadata: {
          [DODO_METADATA_KEYS.orderId]: "order-1",
          [DODO_METADATA_KEYS.organizationId]: "org-a",
          [DODO_METADATA_KEYS.planSlug]: "sponsorship-tracking-monthly",
        },
        return_url: "https://example.com/billing/return?orderId=order-1",
      })
    );
    // UPI-first payment methods, cards always available
    const methods = create.mock.calls[0]?.[0]?.allowed_payment_method_types as string[];
    expect(methods).toContain("upi_collect");
    expect(methods).toContain("credit");
    expect(methods).toContain("debit");
  });

  it("rejects unsupported currency (fail closed)", async () => {
    await expect(
      createDodoCheckoutSession({ ...checkoutInput, currency: "EUR" }, { client: fakeClient() })
    ).rejects.toThrow("supported currency");
  });

  it("builds an international USD session without a forced IN address (cards only)", async () => {
    const client = fakeClient({
      products: {
        retrieve: vi.fn(async (productId: string) => ({
          product_id: productId,
          is_recurring: false,
          price: { type: "one_time_price", currency: "USD", price: 1999 },
        })),
      },
    });
    const result = await createDodoCheckoutSession(
      {
        ...checkoutInput,
        amountMinor: 1999,
        currency: "USD",
        productId: "pdt_sponsor_monthly_usd",
        planSlug: "sponsorship-tracking-monthly-usd",
      },
      { client }
    );
    expect(result.sessionId).toBe("cks_test_1");
    const create = client.checkoutSessions.create as ReturnType<typeof vi.fn>;
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        product_cart: [{ product_id: "pdt_sponsor_monthly_usd", quantity: 1 }],
        billing_currency: "USD",
        metadata: expect.objectContaining({ [DODO_METADATA_KEYS.planSlug]: "sponsorship-tracking-monthly-usd" }),
      })
    );
    // No forced country: the customer provides their actual billing country
    // in hosted checkout; price cannot be influenced by it (fixed product).
    const params = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params).not.toHaveProperty("billing_address");
    const methods = params.allowed_payment_method_types as string[];
    expect(methods).toContain("credit");
    expect(methods).toContain("debit");
    expect(methods).not.toContain("upi_collect");
  });

  it("rejects non-positive amounts", async () => {
    await expect(createDodoCheckoutSession({ ...checkoutInput, amountMinor: 0 }, { client: fakeClient() })).rejects.toThrow();
    await expect(createDodoCheckoutSession({ ...checkoutInput, amountMinor: -5 }, { client: fakeClient() })).rejects.toThrow();
  });

  it("rejects missing product/order correlation", async () => {
    await expect(createDodoCheckoutSession({ ...checkoutInput, productId: "" }, { client: fakeClient() })).rejects.toThrow();
    await expect(createDodoCheckoutSession({ ...checkoutInput, orderId: "" }, { client: fakeClient() })).rejects.toThrow();
    await expect(createDodoCheckoutSession({ ...checkoutInput, returnUrl: "" }, { client: fakeClient() })).rejects.toThrow();
  });

  it("fails closed when checkout returns no URL", async () => {
    const client = fakeClient({ checkoutSessions: { create: vi.fn(async () => ({ session_id: "cks_x", checkout_url: null })) } });
    await expect(createDodoCheckoutSession(checkoutInput, { client })).rejects.toThrow("no checkout URL");
  });
});

describe("dodo adapter — webhook verification (Standard Webhooks)", () => {
  // whsec_ + base64(32 bytes) — signing only, never a real secret
  const key = `whsec_${Buffer.from("test-webhook-secret-0123456789abcdef").toString("base64")}`;

  function signedHeaders(rawBody: string, id: string) {
    const wh = new Webhook(key);
    const timestamp = new Date();
    const signature = wh.sign(id, timestamp, rawBody);
    return { "webhook-id": id, "webhook-signature": signature, "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)) };
  }

  it("accepts a correctly signed payload", () => {
    const rawBody = JSON.stringify({ type: "payment.succeeded", data: { payload_type: "Payment", payment_id: "pay_1" } });
    const headers = signedHeaders(rawBody, "evt_1");
    const result = verifyDodoWebhook({ rawBody, headers, webhookKey: key });
    expect(result.valid).toBe(true);
  });

  it("rejects tampered body", () => {
    const rawBody = JSON.stringify({ type: "payment.succeeded" });
    const headers = signedHeaders(JSON.stringify({ type: "payment.failed" }), "evt_1");
    const result = verifyDodoWebhook({ rawBody, headers, webhookKey: key });
    expect(result.valid).toBe(false);
  });

  it("rejects missing signature material", () => {
    expect(verifyDodoWebhook({ rawBody: "", headers: {}, webhookKey: key }).valid).toBe(false);
    expect(verifyDodoWebhook({ rawBody: "{}", headers: {} as Record<string, string>, webhookKey: key }).valid).toBe(false);
  });
});

describe("dodo adapter — webhook parsing", () => {
  const paymentPayload = (overrides: Record<string, unknown> = {}) =>
    JSON.stringify({
      type: "payment.succeeded",
      business_id: "biz_1",
      timestamp: "2026-10-18T00:00:00Z",
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

  it("normalizes payment.succeeded with metadata correlation", () => {
    const parsed = parseDodoWebhook(paymentPayload(), "wh_1");
    expect(parsed).toMatchObject({
      provider: "dodo",
      eventType: "payment.succeeded",
      providerPaymentId: "pay_dodo_1",
      amountMinor: 149900,
      currency: "INR",
      paymentStatus: "succeeded",
      orderId: "order-1",
    });
    expect(parsed?.externalEventId).toBe("payment.succeeded:wh_1");
  });

  it("parses subscription events as unsupported (never fulfill from them)", () => {
    const raw = JSON.stringify({ type: "subscription.renewed", data: { payload_type: "Subscription", subscription_id: "sub_1" } });
    const parsed = parseDodoWebhook(raw, "wh_2");
    expect(parsed?.eventType).toBe("subscription.renewed");
    expect(parsed?.providerPaymentId).toBeNull();
  });

  it("returns null for malformed payloads", () => {
    expect(parseDodoWebhook("not json", "wh_3")).toBeNull();
    expect(parseDodoWebhook(JSON.stringify({ noType: true }), "wh_4")).toBeNull();
  });
});

describe("dodo adapter — authoritative fetch", () => {
  it("normalizes payment retrieve with metadata order correlation", async () => {
    const fetched = await fetchDodoPayment("pay_test_1", { client: fakeClient() });
    expect(fetched).toMatchObject({
      providerPaymentId: "pay_test_1",
      amountMinor: 149900,
      currency: "INR",
      status: "succeeded",
      orderId: "order-1",
    });
    expect(fetched.subscriptionIds).toEqual([]);
    expect(fetched.productIds).toEqual(["pdt_sponsor_monthly"]);
  });

  it("requires payment id and normalizes fetch failures", async () => {
    await expect(fetchDodoPayment("", { client: fakeClient() })).rejects.toThrow("requires payment ID");
    const failing = fakeClient({ payments: { retrieve: vi.fn(async () => { throw new Error("not found"); }) } });
    await expect(fetchDodoPayment("pay_missing", { client: failing })).rejects.toThrow("Dodo fetchPayment failed");
  });
});

describe("dodo product validation — targeted, fail closed", () => {
  const expectation = {
    productId: "pdt_sponsor_monthly",
    amountMinor: 149900,
    currency: "INR",
    billingPeriod: "monthly",
  };

  it("accepts a matching one-time product", async () => {
    const result = await validateDodoProduct(expectation, { client: fakeClient() });
    expect(result).toEqual({ valid: true, productId: "pdt_sponsor_monthly" });
  });

  it("rejects currency mismatch (USD product for INR plan and vice versa)", async () => {
    const usdClient = fakeClient({
      products: {
        retrieve: vi.fn(async (productId: string) => ({
          product_id: productId,
          is_recurring: false,
          price: { type: "one_time_price", currency: "USD", price: 149900 },
        })),
      },
    });
    expect((await validateDodoProduct(expectation, { client: usdClient })).valid).toBe(false);
  });

  it("rejects amount mismatch (wrong product price)", async () => {
    const wrongPrice = fakeClient({
      products: {
        retrieve: vi.fn(async (productId: string) => ({
          product_id: productId,
          is_recurring: false,
          price: { type: "one_time_price", currency: "INR", price: 1 },
        })),
      },
    });
    const result = await validateDodoProduct(expectation, { client: wrongPrice });
    expect(result.valid).toBe(false);
    expect((result as { reason: string }).reason).toBe("product amount mismatch");
  });

  it("rejects recurring products and non-fixed pricing", async () => {
    const recurring = fakeClient({
      products: {
        retrieve: vi.fn(async (productId: string) => ({
          product_id: productId,
          is_recurring: true,
          price: { type: "recurring_price", currency: "INR", price: 149900 },
        })),
      },
    });
    expect((await validateDodoProduct(expectation, { client: recurring })).valid).toBe(false);

    const pwyw = fakeClient({
      products: {
        retrieve: vi.fn(async (productId: string) => ({
          product_id: productId,
          is_recurring: false,
          price: { type: "one_time_price", currency: "INR", price: 149900, pay_what_you_want: true },
        })),
      },
    });
    expect((await validateDodoProduct(expectation, { client: pwyw })).valid).toBe(false);
  });

  it("rejects missing products (fetch failure fails closed)", async () => {
    const missing = fakeClient({
      products: { retrieve: vi.fn(async () => { throw new Error("not found"); }) },
    });
    const result = await validateDodoProduct(expectation, { client: missing });
    expect(result.valid).toBe(false);
  });

  it("validates only the required product (unrelated misconfiguration never blocks)", async () => {
    // The validator takes an explicit expectation — there is no startup-wide
    // sweep. An unrelated bad product is simply never passed in.
    const usdExpectation = {
      productId: "pdt_sponsor_monthly_usd",
      amountMinor: 1999,
      currency: "USD",
      billingPeriod: "monthly",
    };
    const usdClient = fakeClient({
      products: {
        retrieve: vi.fn(async (productId: string) => ({
          product_id: productId,
          is_recurring: false,
          price: { type: "one_time_price", currency: "USD", price: 1999 },
        })),
      },
    });
    expect(await validateDodoProduct(usdExpectation, { client: usdClient })).toEqual({
      valid: true,
      productId: "pdt_sponsor_monthly_usd",
    });
  });
});
describe("dodo product mapping — plan slug keyed, fail closed", () => {
  beforeEach(() => {
    process.env.DODO_PRODUCT_SPONSORSHIP_TRACKING_MONTHLY = "pdt_sponsor_m";
    process.env.DODO_PRODUCT_ALL_ACCESS_YEARLY = "pdt_all_y";
    delete process.env.DODO_PRODUCT_TIE_BREAKER_MONTHLY;
  });

  it("resolves configured plan slugs", () => {
    expect(getDodoProductIdForPlanSlug("sponsorship-tracking-monthly")).toBe("pdt_sponsor_m");
    expect(getDodoProductIdForPlanSlug("all-access-yearly")).toBe("pdt_all_y");
  });

  it("resolves USD sponsorship slugs from dedicated env vars (no cross-currency fallback)", () => {
    process.env.DODO_PRODUCT_SPONSORSHIP_TRACKING_MONTHLY_USD = "pdt_sponsor_m_usd";
    process.env.DODO_PRODUCT_SPONSORSHIP_TRACKING_YEARLY_USD = "pdt_sponsor_y_usd";
    expect(getDodoProductIdForPlanSlug("sponsorship-tracking-monthly-usd")).toBe("pdt_sponsor_m_usd");
    expect(getDodoProductIdForPlanSlug("sponsorship-tracking-yearly-usd")).toBe("pdt_sponsor_y_usd");
  });

  it("returns null for unknown slugs and unconfigured products", () => {
    expect(getDodoProductIdForPlanSlug("not-a-plan")).toBeNull();
    expect(getDodoProductIdForPlanSlug("tie-breaker-monthly")).toBeNull();
  });
});
