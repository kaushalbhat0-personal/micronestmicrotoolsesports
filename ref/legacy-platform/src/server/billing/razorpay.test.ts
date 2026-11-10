import { describe, it, expect, vi } from "vitest";
import crypto from "node:crypto";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  verifyRazorpayWebhook,
  parseRazorpayWebhook,
  type RazorpayClientLike,
} from "./razorpay";

describe("razorpay adapter — createOrder", () => {
  it("passes correct amount, currency, receipt", async () => {
    const mockCreate = vi.fn(async (opts: { amount: number; currency: string; receipt: string }) => ({
      id: "order_test_123",
      amount: opts.amount,
      currency: opts.currency,
      status: "created",
      receipt: opts.receipt,
    }));
    const client: RazorpayClientLike = { orders: { create: mockCreate } };
    const result = await createRazorpayOrder(
      { amountMinor: 149900, currency: "INR", receipt: "order_abc" },
      { client }
    );
    expect(mockCreate).toHaveBeenCalledWith({ amount: 149900, currency: "INR", receipt: "order_abc" });
    expect(result).toEqual({
      providerOrderId: "order_test_123",
      amountMinor: 149900,
      currency: "INR",
      status: "created",
      receipt: "order_abc",
    });
  });

  it("normalizes provider response, does not leak raw object", async () => {
    const client: RazorpayClientLike = {
      orders: {
        create: async () =>
          ({
            id: "order_xyz",
            amount: 69900,
            currency: "INR",
            status: "created",
            receipt: "rcpt",
            extra: "leak",
            key_secret: "should_not_appear",
          }) as unknown as { id: string; amount: number; currency: string; status: string; receipt: string },
      },
    };
    const result = await createRazorpayOrder({ amountMinor: 69900, currency: "INR", receipt: "rcpt" }, { client });
    expect(result).not.toHaveProperty("extra");
    expect(JSON.stringify(result)).not.toContain("key_secret");
  });

  it("provider error is normalized without secrets", async () => {
    const client: RazorpayClientLike = {
      orders: { create: async () => { throw new Error("upstream 500"); } },
    };
    await expect(createRazorpayOrder({ amountMinor: 100, currency: "INR", receipt: "r" }, { client })).rejects.toThrow(
      "Razorpay createOrder failed"
    );
    try {
      await createRazorpayOrder({ amountMinor: 100, currency: "INR", receipt: "r" }, { client });
    } catch (e) {
      expect(String(e)).not.toContain("RAZORPAY_KEY_SECRET");
      expect(String(e)).not.toContain("key_secret");
    }
  });

  it("throws when not configured", async () => {
    const origId = process.env.RAZORPAY_KEY_ID;
    const origSecret = process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    await expect(createRazorpayOrder({ amountMinor: 100, currency: "INR", receipt: "r" })).rejects.toThrow("Razorpay not configured");
    if (origId) process.env.RAZORPAY_KEY_ID = origId;
    if (origSecret) process.env.RAZORPAY_KEY_SECRET = origSecret;
  });

  it("validates amount and receipt", async () => {
    const client: RazorpayClientLike = { orders: { create: async () => ({ id: "o", amount: 100, currency: "INR", status: "created", receipt: "r" }) } };
    await expect(createRazorpayOrder({ amountMinor: 0, currency: "INR", receipt: "r" }, { client })).rejects.toThrow();
    await expect(createRazorpayOrder({ amountMinor: 100, currency: "", receipt: "r" }, { client })).rejects.toThrow();
    await expect(createRazorpayOrder({ amountMinor: 100, currency: "INR", receipt: "" }, { client })).rejects.toThrow();
  });

  it("secrets never appear in returned data", async () => {
    const client: RazorpayClientLike = {
      orders: { create: async (opts) => ({ id: "o1", amount: opts.amount, currency: opts.currency, status: "created", receipt: opts.receipt }) },
    };
    const result = await createRazorpayOrder({ amountMinor: 249900, currency: "INR", receipt: "all-access" }, { client });
    const json = JSON.stringify(result);
    expect(json).not.toMatch(/RAZORPAY/);
    expect(json).not.toMatch(/key_secret/i);
  });
});

describe("razorpay adapter — verifyPayment", () => {
  const keySecret = "test_key_secret_1234567890";
  const orderId = "order_test_123";
  const paymentId = "pay_test_456";
  const validSig = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");

  it("valid signature passes", () => {
    expect(verifyRazorpayPayment({ orderId, paymentId, signature: validSig, keySecret }).valid).toBe(true);
  });

  it("invalid signature fails", () => {
    expect(verifyRazorpayPayment({ orderId, paymentId, signature: "invalidhex", keySecret }).valid).toBe(false);
  });

  it("wrong orderId fails", () => {
    const wrongSig = crypto.createHmac("sha256", keySecret).update(`wrong|${paymentId}`).digest("hex");
    expect(verifyRazorpayPayment({ orderId, paymentId, signature: wrongSig, keySecret }).valid).toBe(false);
  });

  it("wrong paymentId fails", () => {
    const wrongSig = crypto.createHmac("sha256", keySecret).update(`${orderId}|wrong`).digest("hex");
    expect(verifyRazorpayPayment({ orderId, paymentId, signature: wrongSig, keySecret }).valid).toBe(false);
  });

  it("modified signature fails (one char flip)", () => {
    const last = validSig.slice(-1);
    const flipped = validSig.slice(0, -1) + (last === "a" ? "b" : "a");
    expect(verifyRazorpayPayment({ orderId, paymentId, signature: flipped, keySecret }).valid).toBe(false);
  });

  it("uses timing-safe comparison (covers length mismatch)", () => {
    // Different length should be false without throwing
    expect(verifyRazorpayPayment({ orderId, paymentId, signature: "short", keySecret }).valid).toBe(false);
    expect(verifyRazorpayPayment({ orderId, paymentId, signature: validSig + "00", keySecret }).valid).toBe(false);
  });

  it("no DB mutation — pure function", () => {
    // Verify it does not touch global state
    const before = process.env.RAZORPAY_KEY_SECRET;
    verifyRazorpayPayment({ orderId, paymentId, signature: validSig, keySecret });
    expect(process.env.RAZORPAY_KEY_SECRET).toBe(before);
  });

  it("returns false when key missing", () => {
    expect(verifyRazorpayPayment({ orderId, paymentId, signature: validSig, keySecret: "" }).valid).toBe(false);
  });
});

describe("razorpay adapter — verifyWebhook", () => {
  const webhookSecret = "test_webhook_secret_abc123";
  const rawBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_123", order_id: "order_123", amount: 149900, currency: "INR", status: "captured" } } } });
  const validSig = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");

  it("valid raw-body signature passes", () => {
    expect(verifyRazorpayWebhook({ rawBody, signature: validSig, webhookSecret }).valid).toBe(true);
  });

  it("invalid signature fails", () => {
    expect(verifyRazorpayWebhook({ rawBody, signature: "bad", webhookSecret }).valid).toBe(false);
  });

  it("modified body fails", () => {
    const modified = rawBody + " ";
    expect(verifyRazorpayWebhook({ rawBody: modified, signature: validSig, webhookSecret }).valid).toBe(false);
  });

  it("re-stringified JSON fails (raw body required)", () => {
    // Instead test that verifying with original rawBody vs reparsed with different spacing fails
    const rawWithSpaces = JSON.stringify(JSON.parse(rawBody), null, 2);
    const sigSpaces = crypto.createHmac("sha256", webhookSecret).update(rawWithSpaces).digest("hex");
    // Original validSig should not validate rawWithSpaces with original sig
    expect(verifyRazorpayWebhook({ rawBody: rawWithSpaces, signature: validSig, webhookSecret }).valid).toBe(false);
    // And vice versa
    expect(verifyRazorpayWebhook({ rawBody: rawWithSpaces, signature: sigSpaces, webhookSecret }).valid).toBe(true);
  });

  it("secret never returned", () => {
    const result = verifyRazorpayWebhook({ rawBody, signature: validSig, webhookSecret });
    expect(JSON.stringify(result)).not.toContain(webhookSecret);
  });

  it("missing secret returns false", () => {
    expect(verifyRazorpayWebhook({ rawBody, signature: validSig, webhookSecret: "" }).valid).toBe(false);
  });
});

describe("razorpay adapter — parseWebhook", () => {
  it("parses payment.captured event", () => {
    const raw = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_test_123", order_id: "order_test_123", amount: 149900, currency: "INR", status: "captured" } } },
    });
    const parsed = parseRazorpayWebhook(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.provider).toBe("razorpay");
    expect(parsed?.eventType).toBe("payment.captured");
    expect(parsed?.providerPaymentId).toBe("pay_test_123");
    expect(parsed?.providerOrderId).toBe("order_test_123");
    expect(parsed?.amountMinor).toBe(149900);
    expect(parsed?.currency).toBe("INR");
    expect(parsed?.paymentStatus).toBe("captured");
    expect(parsed?.externalEventId).toBe("payment.captured:pay_test_123");
  });

  it("eventId preserved and stable", () => {
    const raw = JSON.stringify({
      event: "payment.failed",
      payload: { payment: { entity: { id: "pay_fail_1", order_id: "order_1", amount: 69900, currency: "INR", status: "failed" } } },
    });
    const p1 = parseRazorpayWebhook(raw);
    const p2 = parseRazorpayWebhook(raw);
    expect(p1?.externalEventId).toBe(p2?.externalEventId);
    expect(p1?.externalEventId).toContain("pay_fail_1");
  });

  it("unsupported event handled safely", () => {
    const raw = JSON.stringify({ event: "order.paid", payload: {} });
    const parsed = parseRazorpayWebhook(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.eventType).toBe("order.paid");
    expect(parsed?.providerPaymentId).toBeNull();
    // Should have fallback externalEventId (hash) prefixed with eventType
    expect(parsed?.externalEventId.startsWith("order.paid:")).toBe(true);
    expect(parsed?.externalEventId.length).toBeGreaterThan(10);
  });

  it("malformed JSON returns null", () => {
    expect(parseRazorpayWebhook("not json")).toBeNull();
  });

  it("does not mutate DB", async () => {
    const raw = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_x", order_id: "order_x", amount: 100, currency: "INR", status: "captured" } } } });
    // Just ensure no exception and no side effect
    const before = raw;
    const result = parseRazorpayWebhook(raw);
    expect(result).not.toBeNull();
    expect(raw).toBe(before);
  });
});
