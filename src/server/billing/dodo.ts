/**
 * Dodo Payments adapter — provider boundary, no business logic.
 * Server-only. No DB mutation, no entitlement, no pricing decisions here.
 *
 * V1 model: one-time Dodo checkout per billing period (manual renewal,
 * parity with the Razorpay flow). No auto-renewing subscriptions.
 *
 * Markets (server-derived from the authoritative plan currency — never from
 * client input, which carries no amount/currency/country/product fields):
 *   - INR: India checkout (IN billing address, UPI + cards).
 *   - USD: International checkout for Sponsorship Tracking only (no forced
 *     IN address — the customer provides their actual billing country in
 *     the hosted checkout; international card methods only).
 */

import DodoPayments from "dodopayments";
import { getDodoConfig } from "@/server/integrations/dodo/client";

/** India market defaults (kept as named exports for existing callers). */
export const DODO_BILLING_CURRENCY = "INR";
export const DODO_BILLING_COUNTRY = "IN";

/** Supported billing currencies for the V1 Dodo flow. Widen only by migration + review. */
export const DODO_SUPPORTED_CURRENCIES = ["INR", "USD"] as const;
export type DodoSupportedCurrency = (typeof DODO_SUPPORTED_CURRENCIES)[number];

export function isSupportedBillingCurrency(currency: string): currency is DodoSupportedCurrency {
  return (DODO_SUPPORTED_CURRENCIES as readonly string[]).includes(currency);
}

export type DodoMarket = {
  /** Forced billing-address country, or null when the customer must provide
   * their actual billing country in the hosted checkout (international). */
  country: string | null;
  allowedPaymentMethodTypes: string[];
};

/**
 * Market checkout parameters derived SOLELY from the authoritative plan
 * currency. There is no country input anywhere in this flow, so a client
 * cannot smuggle a country to obtain cheaper pricing — price always comes
 * from the server-resolved plan.
 */
export const DODO_MARKET_BY_CURRENCY: Record<DodoSupportedCurrency, DodoMarket> = {
  INR: { country: DODO_BILLING_COUNTRY, allowedPaymentMethodTypes: ["upi_collect", "upi_intent", "credit", "debit"] },
  USD: { country: null, allowedPaymentMethodTypes: ["credit", "debit"] },
};

export function getDodoMarketForCurrency(currency: string): DodoMarket {
  if (!isSupportedBillingCurrency(currency)) {
    throw new Error(`Unsupported Dodo billing currency: ${currency}`);
  }
  return DODO_MARKET_BY_CURRENCY[currency];
}

/** Metadata keys attached to every Dodo checkout session (server-derived). */
export const DODO_METADATA_KEYS = {
  orderId: "micronest_order_id",
  organizationId: "micronest_organization_id",
  planSlug: "micronest_plan_slug",
} as const;

export type DodoCheckoutInput = {
  amountMinor: number;
  /** Authoritative plan currency ('INR' for India, 'USD' for international V1). */
  currency: string;
  productId: string;
  customerEmail: string;
  customerName?: string;
  orderId: string;
  organizationId: string;
  planSlug: string;
  returnUrl: string;
  cancelUrl?: string;
};

export type DodoCheckoutResult = {
  sessionId: string;
  checkoutUrl: string;
};

export type DodoPaymentFetchResult = {
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  status: string;
  subscriptionId: string | null;
  /** All subscription ids linked to the payment (empty for one-time). */
  subscriptionIds: string[];
  /**
   * Authoritative product ids for the payment where the Dodo API exposes
   * them (product_cart on retrieve, else best-effort line-items lookup).
   * Null when not exposed — callers must then rely on amount/currency/order
   * equality (Dodo product prices are immutable, validated at checkout).
   */
  productIds: string[] | null;
  orderId: string | null;
};

export type DodoWebhookEvent = {
  provider: "dodo";
  /** Stable idempotency key: event type + provider event/webhook id. */
  externalEventId: string;
  eventType: string;
  providerPaymentId: string | null;
  amountMinor: number | null;
  currency: string | null;
  paymentStatus: string | null;
  orderId: string | null;
};

export type DodoProductExpectation = {
  productId: string;
  amountMinor: number;
  currency: string;
  billingPeriod: string;
};

export type DodoProductValidation =
  | { valid: true; productId: string }
  | { valid: false; reason: string };

/**
 * Minimal Dodo client surface used by this adapter (subset of the official
 * `dodopayments` SDK). Tests inject fakes; production builds the SDK client.
 */
export type DodoClientLike = {
  checkoutSessions: {
    create: (params: {
      product_cart: Array<{ product_id: string; quantity: number }>;
      customer?: { email?: string; name?: string };
      billing_address?: { country?: string };
      billing_currency?: string;
      allowed_payment_method_types?: string[];
      metadata?: Record<string, string>;
      return_url?: string;
      cancel_url?: string;
    }) => Promise<{ session_id: string; checkout_url?: string | null }>;
  };
  payments: {
    retrieve: (paymentId: string) => Promise<{
      payment_id: string;
      status?: string | null;
      total_amount: number;
      currency: string;
      subscription_id?: string | null;
      subscription_ids?: string[] | null;
      product_cart?: Array<{ product_id?: string }> | null;
      metadata?: Record<string, string> | null;
    }>;
    retrieveLineItems?: (paymentId: string) => Promise<{
      items?: Array<{ product_id?: string }> | null;
    } | null>;
  };
  products: {
    retrieve: (productId: string) => Promise<{
      product_id: string;
      is_recurring: boolean;
      price: {
        type: string;
        currency: string;
        price: number;
        pay_what_you_want?: boolean | null;
      };
    }>;
  };
  webhooks: {
    unwrap: (body: string, opts: { headers: Record<string, string>; key?: string }) => unknown;
  };
};

function createDodoClientFromEnv(): DodoClientLike | null {
  const cfg = getDodoConfig();
  if (!cfg) return null;
  const client = new DodoPayments({ bearerToken: cfg.apiKey, environment: cfg.environment });
  return client as unknown as DodoClientLike;
}

/**
 * Create a Dodo hosted checkout session — provider side only.
 * Amount/product/customer are already server-resolved. Does NOT look up
 * plans/prices and does NOT create/touch the MicroNest order.
 * Market (address country + payment methods) is derived from the
 * authoritative currency — never from client input (there is no country
 * input in this flow at all).
 */
export async function createDodoCheckoutSession(
  input: DodoCheckoutInput,
  deps?: { client?: DodoClientLike }
): Promise<DodoCheckoutResult> {
  if (!input.productId || typeof input.productId !== "string") {
    throw new Error("Dodo checkout requires a product ID");
  }
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("Dodo checkout requires positive integer amountMinor");
  }
  if (!isSupportedBillingCurrency(input.currency)) {
    throw new Error(`Dodo checkout requires a supported currency (${DODO_SUPPORTED_CURRENCIES.join("/")})`);
  }
  if (!input.orderId || !input.organizationId || !input.planSlug) {
    throw new Error("Dodo checkout requires order/organization/plan correlation");
  }
  if (!input.returnUrl) throw new Error("Dodo checkout requires return URL");
  if (!input.customerEmail) throw new Error("Dodo checkout requires customer email");

  const market = getDodoMarketForCurrency(input.currency);

  const client = deps?.client ?? createDodoClientFromEnv();
  if (!client) throw new Error("Dodo Payments not configured — missing DODO_PAYMENTS_API_KEY");

  try {
    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: input.productId, quantity: 1 }],
      ...(input.customerName
        ? { customer: { email: input.customerEmail, name: input.customerName } }
        : { customer: { email: input.customerEmail } }),
      // International (USD): omit billing_address so the customer provides
      // their ACTUAL billing country in hosted checkout. That value never
      // influences price (price is fixed by the server-resolved product).
      ...(market.country ? { billing_address: { country: market.country } } : {}),
      billing_currency: input.currency,
      allowed_payment_method_types: market.allowedPaymentMethodTypes,
      metadata: {
        [DODO_METADATA_KEYS.orderId]: input.orderId,
        [DODO_METADATA_KEYS.organizationId]: input.organizationId,
        [DODO_METADATA_KEYS.planSlug]: input.planSlug,
      },
      return_url: input.returnUrl,
      ...(input.cancelUrl ? { cancel_url: input.cancelUrl } : {}),
    });
    if (!session.checkout_url) {
      throw new Error("Dodo checkout session returned no checkout URL");
    }
    return { sessionId: session.session_id, checkoutUrl: session.checkout_url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Normalize, never include secrets
    throw new Error(`Dodo createCheckoutSession failed: ${msg}`);
  }
}

/**
 * Validate a configured Dodo product against the authoritative plan price
 * BEFORE creating a checkout session (targeted validation: only the product
 * required for this specific checkout is checked, so one misconfigured
 * unrelated product can never make checkout unusable for other plans).
 *
 * Fail-closed: any mismatch or fetch failure returns { valid: false } and
 * the caller must refuse checkout. Never throws for mismatches (returns a
 * reason instead); throws only when no client can be built (misconfigured
 * server). Never includes secrets in reasons.
 */
export async function validateDodoProduct(
  expected: DodoProductExpectation,
  deps?: { client?: DodoClientLike }
): Promise<DodoProductValidation> {
  if (!expected.productId || typeof expected.productId !== "string") {
    return { valid: false, reason: "missing product ID" };
  }
  if (!Number.isInteger(expected.amountMinor) || expected.amountMinor <= 0) {
    return { valid: false, reason: "invalid expected amount" };
  }
  if (!isSupportedBillingCurrency(expected.currency)) {
    return { valid: false, reason: "unsupported expected currency" };
  }
  if (expected.billingPeriod !== "monthly" && expected.billingPeriod !== "yearly") {
    return { valid: false, reason: "unknown billing period" };
  }
  const client = deps?.client ?? createDodoClientFromEnv();
  if (!client) throw new Error("Dodo Payments not configured — missing DODO_PAYMENTS_API_KEY");
  let product: Awaited<ReturnType<DodoClientLike["products"]["retrieve"]>>;
  try {
    product = await client.products.retrieve(expected.productId);
  } catch {
    return { valid: false, reason: "product not found" };
  }
  if (!product || product.product_id !== expected.productId) {
    return { valid: false, reason: "product not found" };
  }
  // V1 sells one-time checkouts per billing period only — never recurring.
  if (product.is_recurring !== false) {
    return { valid: false, reason: "product is recurring" };
  }
  if (product.price?.type !== "one_time_price") {
    return { valid: false, reason: "product is not one-time" };
  }
  // Fixed-price only: pay-what-you-want would let the buyer choose the amount.
  if (product.price?.pay_what_you_want === true) {
    return { valid: false, reason: "product price is not fixed" };
  }
  if (String(product.price?.currency) !== expected.currency) {
    return { valid: false, reason: "product currency mismatch" };
  }
  if (product.price?.price !== expected.amountMinor) {
    return { valid: false, reason: "product amount mismatch" };
  }
  // Billing period/interval: one-time Dodo products expose no interval; the
  // period binding comes from our authoritative plan (plan.billing_period),
  // enforced by checkout + webhook against plan/order/payment equality.
  return { valid: true, productId: expected.productId };
}

/**
 * Verify a Dodo webhook using the official Standard Webhooks mechanism.
 * The SDK checks the HMAC signature, the timestamp tolerance (replay
 * protection), and parses the payload. Never logs secrets.
 */
export function verifyDodoWebhook(args: {
  rawBody: string;
  headers: Record<string, string>;
  webhookKey?: string;
}): { valid: boolean; event?: unknown } {
  if (!args.rawBody) return { valid: false };
  const key = args.webhookKey ?? getDodoConfig()?.webhookKey ?? process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  if (!key) return { valid: false };
  try {
    const client = new DodoPayments({
      bearerToken: "webhook-verify-only",
      webhookKey: key,
    });
    const event = (client as unknown as DodoClientLike).webhooks.unwrap(args.rawBody, {
      headers: args.headers,
    });
    return { valid: true, event };
  } catch {
    return { valid: false };
  }
}

/**
 * Fetch authoritative Dodo payment for amount/currency/status validation.
 * Server-side only. Never trust webhook payload amounts alone.
 * Also surfaces subscription linkage (must be empty for V1 one-time) and
 * product ids where the Dodo API exposes them (fail-closed downstream).
 */
export async function fetchDodoPayment(
  paymentId: string,
  deps?: { client?: DodoClientLike }
): Promise<DodoPaymentFetchResult> {
  if (!paymentId) throw new Error("Dodo fetchPayment requires payment ID");
  const client = deps?.client ?? createDodoClientFromEnv();
  if (!client) throw new Error("Dodo Payments not configured — missing DODO_PAYMENTS_API_KEY");
  try {
    const p = await client.payments.retrieve(paymentId);
    const metadata = (p.metadata ?? {}) as Record<string, string>;
    const subscriptionIds = Array.isArray(p.subscription_ids)
      ? p.subscription_ids.filter((s): s is string => typeof s === "string")
      : [];
    const subscriptionId = typeof p.subscription_id === "string" ? p.subscription_id : (subscriptionIds[0] ?? null);
    let productIds: string[] | null = null;
    if (Array.isArray(p.product_cart)) {
      const ids = p.product_cart
        .map((item) => item?.product_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      productIds = ids.length > 0 ? ids : null;
      // Empty (but present) cart still counts as "exposed": a one-time
      // checkout must reference exactly the expected product.
      if (p.product_cart.length === 0) productIds = [];
    } else if (typeof client.payments.retrieveLineItems === "function") {
      // Best-effort: line-items may be unavailable in some modes/regions.
      // Failure here must NOT fail the fetch — amount/currency/order checks
      // below still bind the payment to the order.
      try {
        const lines = await client.payments.retrieveLineItems(paymentId);
        const ids = (lines?.items ?? [])
          .map((item) => item?.product_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0);
        productIds = ids.length > 0 ? ids : null;
      } catch {
        productIds = null;
      }
    }
    return {
      providerPaymentId: p.payment_id,
      amountMinor: p.total_amount,
      currency: String(p.currency),
      status: String(p.status ?? "unknown"),
      subscriptionId,
      subscriptionIds,
      productIds,
      orderId: metadata[DODO_METADATA_KEYS.orderId] ?? null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Dodo fetchPayment failed: ${msg}`);
  }
}

/**
 * Parse a verified Dodo webhook payload into a normalized event.
 * Never mutates DB; caller handles webhook_events idempotency.
 * V1 handles payment.* events; subscription.* events are surfaced as
 * unsupported (no auto-renewal model) and must never provision.
 */
export function parseDodoWebhook(rawBody: string, webhookId: string): DodoWebhookEvent | null {
  let parsed: {
    type?: unknown;
    data?: {
      payload_type?: unknown;
      payment_id?: unknown;
      total_amount?: unknown;
      currency?: unknown;
      status?: unknown;
      metadata?: unknown;
    } | null;
  };
  try {
    parsed = JSON.parse(rawBody) as typeof parsed;
  } catch {
    return null;
  }
  const eventType = typeof parsed.type === "string" ? parsed.type : null;
  if (!eventType) return null;
  const data = parsed.data ?? null;
  const isPayment = data?.payload_type === "Payment";
  const paymentId = isPayment && typeof data?.payment_id === "string" ? (data.payment_id as string) : null;
  const amountMinor = isPayment && typeof data?.total_amount === "number" ? (data.total_amount as number) : null;
  const currency = isPayment && typeof data?.currency === "string" ? (data.currency as string) : null;
  const paymentStatus = isPayment && typeof data?.status === "string" ? (data.status as string) : null;
  const metadata = isPayment && data?.metadata && typeof data.metadata === "object" ? (data.metadata as Record<string, string>) : {};
  const orderId = metadata[DODO_METADATA_KEYS.orderId] ?? null;

  const externalEventId = webhookId ? `${eventType}:${webhookId}` : `${eventType}:${paymentId ?? "unknown"}`;

  return {
    provider: "dodo",
    externalEventId,
    eventType,
    providerPaymentId: paymentId,
    amountMinor,
    currency,
    paymentStatus,
    orderId,
  };
}
