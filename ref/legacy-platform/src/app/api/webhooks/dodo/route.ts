import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  verifyDodoWebhook,
  parseDodoWebhook,
  fetchDodoPayment,
  isSupportedBillingCurrency,
} from "@/server/billing/dodo";
import { getDodoConfig, getDodoProductIdForPlanSlug } from "@/server/integrations/dodo/client";

/**
 * Dodo Payments webhook — V1 one-time checkout per billing period.
 * Only payment.succeeded fulfills (via canonical complete_dodo_payment RPC).
 * Subscription events are recorded but never provision (no auto-renewal model).
 *
 * Trust model (all server-authoritative, never browser redirect, never raw
 * webhook amounts):
 *  - signature via Standard Webhooks (timestamp tolerance = replay protection)
 *  - webhook-id idempotency via webhook_events unique(provider, external_event_id)
 *  - order resolved from server-set metadata, then cross-checked against the
 *    authoritative Dodo payment fetch: payment id, order id, amount, currency,
 *    plan amount/currency/period, expected product (where exposed), org.
 *  - USD payment ↔ INR order (and vice versa) always fails closed.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const webhookId = request.headers.get("webhook-id") ?? "";
  const signature = request.headers.get("webhook-signature") ?? "";
  const timestamp = request.headers.get("webhook-timestamp") ?? "";

  if (!webhookId || !signature) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Missing webhook signature" } }, { status: 400 });
  }

  const webhookKey = getDodoConfig()?.webhookKey ?? process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  if (!webhookKey) {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Webhook not configured" } }, { status: 500 });
  }

  const verified = verifyDodoWebhook({ rawBody, headers: { "webhook-id": webhookId, "webhook-signature": signature, "webhook-timestamp": timestamp }, webhookKey });
  if (!verified.valid) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid webhook signature" } }, { status: 400 });
  }

  const parsed = parseDodoWebhook(rawBody, webhookId);
  if (!parsed) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Malformed webhook payload" } }, { status: 400 });
  }

  const admin = createAdminClient();

  // Retry-safe webhook event deduplication (same shape as the Razorpay route)
  const { data: insertedEvent, error: insertError } = await admin
    .from("webhook_events")
    .insert({
      provider: "dodo",
      provider_event_id: parsed.externalEventId,
      external_event_id: parsed.externalEventId,
      event_type: parsed.eventType,
      payload: JSON.parse(rawBody),
      organization_id: null,
      platform: "dodo",
      status: "pending",
      processed: false,
    })
    .select("id, status, processed")
    .single();

  let webhookEventId: string | null = (insertedEvent as { id: string } | null)?.id ?? null;

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: existing } = await admin
        .from("webhook_events")
        .select("id, status, processed")
        .eq("provider", "dodo")
        .eq("external_event_id", parsed.externalEventId)
        .maybeSingle();

      if (!existing) {
        console.error("[webhook:dodo] duplicate but no existing row found");
        return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to record webhook" } }, { status: 500 });
      }

      const existingStatus = (existing as { status: string | null; processed: boolean | null }).status;
      const existingProcessed = (existing as { status: string | null; processed: boolean | null }).processed;

      if (existingStatus === "succeeded" || existingProcessed === true) {
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
      }

      const { data: claimed, error: claimError } = await admin
        .from("webhook_events")
        .update({ status: "processing", processed: false })
        .eq("provider", "dodo")
        .eq("external_event_id", parsed.externalEventId)
        .in("status", ["pending", "failed"])
        .select("id")
        .maybeSingle();

      if (claimError || !claimed) {
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
      }
      webhookEventId = (claimed as { id: string }).id;
    } else {
      console.error("[webhook:dodo] insert failed", insertError);
      return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to record webhook" } }, { status: 500 });
    }
  } else {
    if (webhookEventId) {
      await admin.from("webhook_events").update({ status: "processing" }).eq("id", webhookEventId);
    }
  }

  // V1: only payment.succeeded fulfills. Subscription events are recorded
  // without provisioning (manual-renewal model — no auto-renewal).
  if (parsed.eventType === "payment.processing") {
    if (webhookEventId) {
      await admin.from("webhook_events").update({ status: "succeeded", processed: true, processed_at: new Date().toISOString() }).eq("id", webhookEventId);
    }
    return NextResponse.json({ received: true, pending: parsed.eventType }, { status: 200 });
  }

  if (parsed.eventType !== "payment.succeeded" && parsed.eventType !== "payment.failed" && parsed.eventType !== "payment.cancelled") {
    if (webhookEventId) {
      await admin.from("webhook_events").update({ status: "succeeded", processed: true, processed_at: new Date().toISOString() }).eq("id", webhookEventId);
    }
    return NextResponse.json({ received: true, unsupported: parsed.eventType }, { status: 200 });
  }

  if (!parsed.orderId) {
    // No internal order correlation — record for investigation, ack to avoid retries
    if (webhookEventId) {
      await admin.from("webhook_events").update({ status: "failed", processed: true, processed_at: new Date().toISOString() }).eq("id", webhookEventId);
    }
    return NextResponse.json({ received: true, orderNotFound: true }, { status: 200 });
  }

  // Resolve MicroNest order from server-set metadata (never client input)
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, organization_id, plan_id, amount_minor, currency, provider, dodo_session_id, status")
    .eq("id", parsed.orderId)
    .maybeSingle();

  if (orderError || !order) {
    if (webhookEventId) {
      await admin.from("webhook_events").update({ status: "failed", processed: true, processed_at: new Date().toISOString() }).eq("id", webhookEventId);
    }
    return NextResponse.json({ received: true, orderNotFound: true }, { status: 200 });
  }

  const ord = order as {
    id: string;
    organization_id: string;
    plan_id: string;
    amount_minor: number;
    currency: string;
    provider: string;
    status: string;
  };

  if (ord.provider !== "dodo") {
    if (webhookEventId) {
      await admin.from("webhook_events").update({ status: "failed", processed: true }).eq("id", webhookEventId);
    }
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Order is not a Dodo order" } }, { status: 400 });
  }

  if (webhookEventId) {
    await admin.from("webhook_events").update({ organization_id: ord.organization_id }).eq("id", webhookEventId);
  }

  // Terminal non-success: mark created orders failed (scoped to created only — never touch paid)
  if (parsed.eventType === "payment.failed" || parsed.eventType === "payment.cancelled") {
    if (ord.status === "created") {
      await admin.from("orders").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", ord.id).eq("status", "created");
    }
    if (webhookEventId) {
      await admin.from("webhook_events").update({ status: "succeeded", processed: true, processed_at: new Date().toISOString() }).eq("id", webhookEventId);
    }
    return NextResponse.json({ received: true, status: parsed.eventType }, { status: 200 });
  }

  if (!parsed.providerPaymentId) {
    if (webhookEventId) {
      await admin.from("webhook_events").update({ status: "failed", processed: true }).eq("id", webhookEventId);
    }
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Missing payment identifier" } }, { status: 400 });
  }

  // Idempotency pre-check: payment already recorded for this dodo_payment_id
  const { data: existingPayment } = await admin
    .from("payments")
    .select("id, status")
    .eq("dodo_payment_id", parsed.providerPaymentId)
    .maybeSingle();

  if (existingPayment) {
    if (webhookEventId) {
      await admin.from("webhook_events").update({ status: "succeeded", processed: true, processed_at: new Date().toISOString() }).eq("id", webhookEventId);
    }
    return NextResponse.json({ received: true, duplicate: true, orderId: ord.id }, { status: 200 });
  }

  // Fetch authoritative payment for amount/currency/status validation (never trust webhook payload alone)
  let fetched: {
    providerPaymentId: string;
    amountMinor: number;
    currency: string;
    status: string;
    subscriptionIds: string[];
    productIds: string[] | null;
    orderId: string | null;
  };
  try {
    fetched = await fetchDodoPayment(parsed.providerPaymentId);
  } catch (err) {
    if (webhookEventId) {
      await admin.from("webhook_events").update({ status: "failed", processed: false, processed_at: new Date().toISOString() }).eq("id", webhookEventId);
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[webhook:dodo] fetch failed", msg);
    return NextResponse.json({ error: { code: "INTEGRATION_ERROR", message: "Failed to fetch payment" } }, { status: 502 });
  }

  if (fetched.providerPaymentId !== parsed.providerPaymentId) {
    if (webhookEventId) await admin.from("webhook_events").update({ status: "failed", processed: true }).eq("id", webhookEventId);
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Payment identifier mismatch" } }, { status: 400 });
  }
  if (fetched.orderId !== null && fetched.orderId !== ord.id) {
    // Cross-organization order: the payment's server-set metadata points at a
    // different order than this webhook claims — never fulfill.
    if (webhookEventId) await admin.from("webhook_events").update({ status: "failed", processed: true }).eq("id", webhookEventId);
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Payment order mismatch" } }, { status: 400 });
  }
  // Currency must agree across authoritative payment, order snapshot, and
  // supported V1 set. USD↔INR cross-currency (either direction) fails closed.
  if (!isSupportedBillingCurrency(fetched.currency) || fetched.currency !== ord.currency) {
    if (webhookEventId) await admin.from("webhook_events").update({ status: "failed", processed: true }).eq("id", webhookEventId);
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Payment currency mismatch" } }, { status: 400 });
  }
  if (fetched.amountMinor !== ord.amount_minor) {
    if (webhookEventId) await admin.from("webhook_events").update({ status: "failed", processed: true }).eq("id", webhookEventId);
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Payment amount mismatch" } }, { status: 400 });
  }
  // V1 is one-time only: any subscription linkage on the payment is rejected.
  if (fetched.subscriptionIds.length > 0) {
    if (webhookEventId) await admin.from("webhook_events").update({ status: "failed", processed: true }).eq("id", webhookEventId);
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Subscription payments are not supported" } }, { status: 400 });
  }
  if (fetched.status !== "succeeded") {
    // Not actually paid (e.g. delayed async method) — acknowledge, wait for the terminal event
    if (webhookEventId) await admin.from("webhook_events").update({ status: "succeeded", processed: true }).eq("id", webhookEventId);
    return NextResponse.json({ received: true, status: fetched.status }, { status: 200 });
  }

  // Authoritative plan: amount/currency/period/product binding. The order
  // snapshot alone is not trusted — it must equal the catalog plan.
  const { data: plan } = await admin
    .from("plans")
    .select("id, slug, billing_period, amount_minor, currency, tool_id")
    .eq("id", ord.plan_id)
    .single();
  const planRow = plan as {
    id: string;
    slug: string;
    billing_period: string;
    amount_minor: number;
    currency: string;
    tool_id: string | null;
  } | null;
  if (!planRow || planRow.amount_minor !== ord.amount_minor || planRow.currency !== ord.currency) {
    if (webhookEventId) await admin.from("webhook_events").update({ status: "failed", processed: true }).eq("id", webhookEventId);
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Order plan mismatch" } }, { status: 400 });
  }
  const billingPeriod = planRow.billing_period ?? "monthly";

  // Expected Dodo product for this plan (server mapping, never client input).
  // Wrong product → no entitlement. Where the Dodo API exposes authoritative
  // product linkage, it must contain the expected product; when unexposed,
  // amount/currency/order equality above still binds the payment.
  const expectedProductId = getDodoProductIdForPlanSlug(planRow.slug);
  if (!expectedProductId) {
    if (webhookEventId) await admin.from("webhook_events").update({ status: "failed", processed: true }).eq("id", webhookEventId);
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Payment not configured for this plan" } }, { status: 400 });
  }
  if (fetched.productIds !== null && !fetched.productIds.includes(expectedProductId)) {
    if (webhookEventId) await admin.from("webhook_events").update({ status: "failed", processed: true }).eq("id", webhookEventId);
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Payment product mismatch" } }, { status: 400 });
  }

  // Canonical completion — same entitlement math as Razorpay, Dodo identifiers
  const { data: rpcData, error: rpcError } = await admin.rpc("complete_dodo_payment", {
    p_order_id: ord.id,
    p_dodo_payment_id: fetched.providerPaymentId,
    p_dodo_signature: signature,
    p_amount_minor: fetched.amountMinor,
    p_currency: fetched.currency,
    p_verified_at: new Date().toISOString(),
    p_billing_period: billingPeriod,
  });

  if (rpcError) {
    if (rpcError.code === "23505" || rpcError.message?.includes("duplicate")) {
      // Lost race with a concurrent completion — return current state
      if (webhookEventId) {
        await admin.from("webhook_events").update({ status: "succeeded", processed: true, processed_at: new Date().toISOString() }).eq("id", webhookEventId);
      }
      return NextResponse.json({ received: true, duplicate: true, orderId: ord.id }, { status: 200 });
    }
    console.error("[webhook:dodo] complete_dodo_payment failed", rpcError);
    if (webhookEventId) await admin.from("webhook_events").update({ status: "failed", processed: false, processed_at: new Date().toISOString() }).eq("id", webhookEventId);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to complete payment" } }, { status: 500 });
  }

  if (webhookEventId) {
    await admin.from("webhook_events").update({ status: "succeeded", processed: true, processed_at: new Date().toISOString() }).eq("id", webhookEventId);
  }

  return NextResponse.json({ received: true, orderId: ord.id, expiresAt: (rpcData as { expires_at: string | null } | null)?.expires_at ?? null }, { status: 200 });
}
