/**
 * Razorpay Test-Mode adapter — provider boundary, no business logic.
 * Server-only. No DB mutation, no entitlement, no pricing decisions here.
 */

import crypto from "node:crypto";

export type RazorpayOrderInput = {
  amountMinor: number;
  currency: string; // 'INR' for V1
  receipt: string;
  notes?: Record<string, string>;
};

export type RazorpayOrderResult = {
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  status: string;
  receipt: string;
};

export type RazorpayPaymentVerification = {
  valid: boolean;
};

export type RazorpayWebhookEvent = {
  provider: "razorpay";
  externalEventId: string;
  eventType: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amountMinor: number | null;
  currency: string | null;
  paymentStatus: string | null;
};

export type RazorpayClientLike = {
  orders: {
    create: (opts: { amount: number; currency: string; receipt: string; notes?: Record<string, string> }) => Promise<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      receipt: string;
    }>;
  };
  payments?: {
    fetch: (paymentId: string) => Promise<{
      id: string;
      order_id: string;
      amount: number;
      currency: string;
      status: string;
    }>;
  };
};

function getRazorpayConfigFromEnv(): { keyId: string; keySecret: string; webhookSecret?: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  return {
    keyId,
    keySecret,
    ...(webhookSecret ? { webhookSecret } : {}),
  };
}

function createRazorpayClientFromEnv(): RazorpayClientLike | null {
  const cfg = getRazorpayConfigFromEnv();
  if (!cfg) return null;
  // Lazy require to keep test mockable and avoid hard dependency in test env without SDK
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Razorpay = require("razorpay");
  return new Razorpay({ key_id: cfg.keyId, key_secret: cfg.keySecret }) as RazorpayClientLike;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  // Compare hex strings via buffers of same length, timing-safe. Length mismatch => false without timing leak on content.
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Create a Razorpay order — provider side only. Amount already server-resolved (paise).
 * Does NOT look up plan/price, does NOT create MicroNest order.
 */
export async function createRazorpayOrder(
  input: RazorpayOrderInput,
  deps?: { client?: RazorpayClientLike; keyId?: string; keySecret?: string }
): Promise<RazorpayOrderResult> {
  if (!input.receipt || typeof input.receipt !== "string") {
    throw new Error("Razorpay order requires receipt");
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("Razorpay order requires positive integer amountMinor");
  }
  if (!input.currency) throw new Error("Razorpay order requires currency");

  const client = deps?.client ?? createRazorpayClientFromEnv();
  if (!client) throw new Error("Razorpay not configured — missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET");

  try {
    const order = await client.orders.create({
      amount: input.amountMinor,
      currency: input.currency,
      receipt: input.receipt,
      ...(input.notes ? { notes: input.notes } : {}),
    });
    return {
      providerOrderId: order.id,
      amountMinor: order.amount,
      currency: order.currency,
      status: order.status,
      receipt: order.receipt,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Normalize, never include secrets
    throw new Error(`Razorpay createOrder failed: ${msg}`);
  }
}

/**
 * Verify Razorpay payment signature: HMAC_SHA256(order_id|payment_id, key_secret)
 * Uses timingSafeEqual, never logs secrets.
 */
export function verifyRazorpayPayment(args: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret?: string;
}): RazorpayPaymentVerification {
  const keySecret = args.keySecret ?? process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return { valid: false };
  if (!args.orderId || !args.paymentId || !args.signature) return { valid: false };

  const payload = `${args.orderId}|${args.paymentId}`;
  const expected = crypto.createHmac("sha256", keySecret).update(payload).digest("hex");
  // Use timing-safe compare on hex strings
  return { valid: timingSafeEqualHex(expected, args.signature) };
}

/**
 * Verify Razorpay webhook signature: HMAC_SHA256(rawBody, webhookSecret)
 * Must receive raw body string, not re-stringified JSON.
 */
export function verifyRazorpayWebhook(args: { rawBody: string; signature: string; webhookSecret?: string }): {
  valid: boolean;
} {
  const secret = args.webhookSecret ?? process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return { valid: false };
  if (!args.rawBody || !args.signature) return { valid: false };
  const expected = crypto.createHmac("sha256", secret).update(args.rawBody).digest("hex");
  // Razorpay sends signature as hex (sometimes with no prefix); compare timing-safe
  return { valid: timingSafeEqualHex(expected, args.signature) };
}

export type RazorpayPaymentFetchResult = {
  providerPaymentId: string;
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  status: string;
};

/**
 * Fetch authoritative Razorpay payment for amount/currency/status validation.
 * Server-side only, uses key_secret (never exposed).
 */
export async function fetchRazorpayPayment(
  paymentId: string,
  deps?: { client?: RazorpayClientLike }
): Promise<RazorpayPaymentFetchResult> {
  const client = deps?.client ?? createRazorpayClientFromEnv();
  if (!client) throw new Error("Razorpay not configured — missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET");
  if (!client.payments?.fetch) throw new Error("Razorpay payments.fetch not available");
  try {
    const p = await client.payments.fetch(paymentId);
    return {
      providerPaymentId: p.id,
      providerOrderId: p.order_id,
      amountMinor: p.amount,
      currency: p.currency,
      status: p.status,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Razorpay fetchPayment failed: ${msg}`);
  }
}

/**
 * Parse Razorpay webhook payload (e.g., payment.captured) into normalized event.
 * Never mutates DB; caller handles webhook_events idempotency.
 */
export function parseRazorpayWebhook(rawBody: string): RazorpayWebhookEvent | null {
  try {
    const parsed = JSON.parse(rawBody) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            amount?: number;
            currency?: string;
            status?: string;
          };
        };
        order?: {
          entity?: {
            id?: string;
          };
        };
      };
      // Razorpay also sends `entity` at top level for some events
      contains?: string[];
    };
    const eventType = typeof parsed.event === "string" ? parsed.event : "unknown";
    // Use event type + payload hash as externalEventId fallback if no entity id
    // Razorpay does not send a single event_id, so we synthesize from payment id + event type when available
    const paymentEntity = parsed.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id ?? null;
    const paymentId = paymentEntity?.id ?? null;
    const amountMinor = typeof paymentEntity?.amount === "number" ? paymentEntity.amount : null;
    const currency = typeof paymentEntity?.currency === "string" ? paymentEntity.currency : null;
    const paymentStatus = typeof paymentEntity?.status === "string" ? paymentEntity.status : null;

    // externalEventId should be stable for idempotency: prefer paymentId + eventType, fallback to raw hash
    let externalEventId: string;
    if (paymentId) externalEventId = `${eventType}:${paymentId}`;
    else {
      // Fallback: hash raw body (deterministic, not cryptographically unique but sufficient for unknown events)
      externalEventId = `unknown:${crypto.createHash("sha256").update(rawBody).digest("hex").slice(0, 16)}`;
    }

    return {
      provider: "razorpay",
      externalEventId,
      eventType,
      providerOrderId: orderId,
      providerPaymentId: paymentId,
      amountMinor,
      currency,
      paymentStatus,
    };
  } catch {
    return null;
  }
}
