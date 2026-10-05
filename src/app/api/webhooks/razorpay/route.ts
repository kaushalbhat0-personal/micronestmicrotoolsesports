import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpayWebhook, parseRazorpayWebhook, fetchRazorpayPayment } from "@/server/billing/razorpay";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? request.headers.get("X-Razorpay-Signature") ?? "";

  if (!signature) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Missing webhook signature" } }, { status: 400 });
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Webhook not configured" } }, { status: 500 });
  }

  const verified = verifyRazorpayWebhook({ rawBody, signature, webhookSecret });
  if (!verified.valid) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid webhook signature" } }, { status: 400 });
  }

  const parsed = parseRazorpayWebhook(rawBody);
  if (!parsed) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Malformed webhook payload" } }, { status: 400 });
  }

  const admin = createAdminClient();

  // Deduplicate webhook event via webhook_events (provider, external_event_id) unique
  // Insert pending, ON CONFLICT DO NOTHING to handle concurrent duplicates
  const { data: insertedEvent, error: insertError } = await admin
    .from("webhook_events")
    .insert({
      provider: "razorpay",
      provider_event_id: parsed.externalEventId,
      external_event_id: parsed.externalEventId,
      event_type: parsed.eventType,
      payload: JSON.parse(rawBody),
      organization_id: null, // will be resolved after order lookup if needed
      platform: "razorpay",
      status: "pending",
      processed: false,
    })
    .select("id")
    .single();

  // If duplicate (unique violation), treat as already processed — 2xx
  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }
    // Other DB error → retryable
    console.error("[webhook:razorpay] insert failed", insertError);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to record webhook" } }, { status: 500 });
  }

  const webhookEventId = (insertedEvent as { id: string } | null)?.id;

  // Only handle payment.captured (and optionally authorized if explicitly supported — currently not)
  if (parsed.eventType !== "payment.captured") {
    // For unsupported events, mark as succeeded without entitlement, but acknowledge 2xx
    if (webhookEventId) {
      await admin.from("webhook_events").update({ status: "succeeded", processed: true, processed_at: new Date().toISOString() }).eq("id", webhookEventId);
    }
    return NextResponse.json({ received: true, unsupported: parsed.eventType }, { status: 200 });
  }

  if (!parsed.providerPaymentId || !parsed.providerOrderId) {
    if (webhookEventId) {
      await admin.from("webhook_events").update({ status: "failed", processed: true, processed_at: new Date().toISOString() }).eq("id", webhookEventId);
    }
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Missing payment identifiers" } }, { status: 400 });
  }

  // Resolve MicroNest order via razorpay_order_id
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, organization_id, plan_id, amount_minor, currency, razorpay_order_id, status")
    .eq("razorpay_order_id", parsed.providerOrderId)
    .maybeSingle();

  if (orderError || !order) {
    // Order not found — record for investigation, but acknowledge 2xx to avoid endless retries (payment may be for unknown order)
    if (webhookEventId) {
      await admin.from("webhook_events").update({ status: "failed", processed: true, processed_at: new Date().toISOString() }).eq("id", webhookEventId);
    }
    return NextResponse.json({ received: true, orderNotFound: true }, { status: 200 });
  }

  // Update webhook event with organization_id for tenant scoping
  if (webhookEventId) {
    await admin.from("webhook_events").update({ organization_id: (order as { organization_id: string }).organization_id }).eq("id", webhookEventId);
  }

  // Fetch authoritative payment for amount/currency/status validation (never trust webhook payload alone)
  let fetched: { providerPaymentId: string; providerOrderId: string; amountMinor: number; currency: string; status: string };
  try {
    fetched = await fetchRazorpayPayment(parsed.providerPaymentId);
  } catch (err) {
    if (webhookEventId) {
      await admin.from("webhook_events").update({ status: "failed", processed: true, processed_at: new Date().toISOString() }).eq("id", webhookEventId);
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[webhook:razorpay] fetch failed", msg);
    return NextResponse.json({ error: { code: "INTEGRATION_ERROR", message: "Failed to fetch payment" } }, { status: 502 });
  }

  if (fetched.providerOrderId !== parsed.providerOrderId) {
    if (webhookEventId) await admin.from("webhook_events").update({ status: "failed", processed: true }).eq("id", webhookEventId);
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Payment order mismatch" } }, { status: 400 });
  }
  const ord = order as { amount_minor: number; currency: string };
  if (fetched.amountMinor !== ord.amount_minor) {
    if (webhookEventId) await admin.from("webhook_events").update({ status: "failed", processed: true }).eq("id", webhookEventId);
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Payment amount mismatch" } }, { status: 400 });
  }
  if (fetched.currency !== ord.currency) {
    if (webhookEventId) await admin.from("webhook_events").update({ status: "failed", processed: true }).eq("id", webhookEventId);
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Payment currency mismatch" } }, { status: 400 });
  }
  if (fetched.status !== "captured") {
    // Authorized but not captured — do not activate, but acknowledge
    if (webhookEventId) await admin.from("webhook_events").update({ status: "succeeded", processed: true }).eq("id", webhookEventId);
    return NextResponse.json({ received: true, status: fetched.status }, { status: 200 });
  }

  // Reuse authoritative completion — single path for browser and webhook
  const { data: plan } = await admin.from("plans").select("billing_period").eq("id", (order as { plan_id: string }).plan_id).single();
  const billingPeriod = (plan as { billing_period: string } | null)?.billing_period ?? "monthly";

  const { data: rpcData, error: rpcError } = await admin.rpc("complete_billing_payment", {
    p_order_id: (order as { id: string }).id,
    p_razorpay_payment_id: fetched.providerPaymentId,
    // Webhook has no browser payment signature; pass null (RPC allows null, payments.razorpay_signature nullable)
    p_razorpay_signature: null as unknown as string,
    p_amount_minor: fetched.amountMinor,
    p_currency: fetched.currency,
    p_verified_at: new Date().toISOString(),
    p_billing_period: billingPeriod,
  });

  if (rpcError) {
    // Unique violation on payments already handled as idempotent inside RPC, but if RPC fails otherwise, mark webhook failed for retry
    console.error("[webhook:razorpay] complete_billing_payment failed", rpcError);
    if (webhookEventId) await admin.from("webhook_events").update({ status: "failed", processed: true }).eq("id", webhookEventId);
    // If it's a duplicate payment (23505), RPC already returns idempotent success, so this branch shouldn't happen for that case
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to complete payment" } }, { status: 500 });
  }

  if (webhookEventId) {
    await admin.from("webhook_events").update({ status: "succeeded", processed: true, processed_at: new Date().toISOString() }).eq("id", webhookEventId);
  }

  return NextResponse.json({ received: true, orderId: (order as { id: string }).id, expiresAt: (rpcData as { expires_at: string | null } | null)?.expires_at ?? null }, { status: 200 });
}
