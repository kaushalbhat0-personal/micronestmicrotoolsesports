import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/get-user";
import { requireOrganizationMember } from "@/lib/auth/require-membership";
import { verifyRazorpayPayment, fetchRazorpayPayment, type RazorpayClientLike } from "./razorpay";
import { calculateRenewedExpiry } from "./expiry";
import type { BillingPeriod } from "./period";

export type VerifyInput = {
  orderId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

export type VerifyResult = {
  success: true;
  orderId: string;
  status: "paid";
  expiresAt: string | null;
};

export async function verifyPaymentAndActivate(
  input: VerifyInput,
  deps?: { razorpayClient?: RazorpayClientLike }
): Promise<VerifyResult> {
  const user = await requireUser();
  void user; // ensure auth

  const admin = createAdminClient();

  // 1. Load MicroNest order
  const { data: order, error: orderError } = await admin.from("orders").select("*").eq("id", input.orderId).single();
  if (orderError || !order) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Invalid order");
  }

  // 2. Verify organization ownership — server-authoritative tenant check
  await requireOrganizationMember(order.organization_id);

  // 3. Verify Razorpay order match (server-side, not client trust)
  if (order.razorpay_order_id !== input.razorpayOrderId) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Razorpay order mismatch");
  }

  // 4. Idempotency: if payment already captured for this razorpay_payment_id, return without re-extending
  const { data: existingPayment } = await admin
    .from("payments")
    .select("id, status")
    .eq("razorpay_payment_id", input.razorpayPaymentId)
    .maybeSingle();

  if (existingPayment) {
    // Already processed — fetch current entitlement expiry for response
    const { data: ent } = await admin
      .from("tool_entitlements")
      .select("expires_at")
      .eq("organization_id", order.organization_id)
      .eq("is_all_access", order.is_all_access)
      .maybeSingle();

    // For per-tool, need tool_id match; handle via query
    let expiresAt: string | null = null;
    if (order.is_all_access) {
      const { data: allEnt } = await admin
        .from("tool_entitlements")
        .select("expires_at")
        .eq("organization_id", order.organization_id)
        .eq("is_all_access", true)
        .maybeSingle();
      expiresAt = (allEnt as { expires_at: string | null } | null)?.expires_at ?? null;
    } else if (order.tool_id) {
      const { data: toolEnt } = await admin
        .from("tool_entitlements")
        .select("expires_at")
        .eq("organization_id", order.organization_id)
        .eq("tool_id", order.tool_id)
        .maybeSingle();
      expiresAt = (toolEnt as { expires_at: string | null } | null)?.expires_at ?? null;
    } else {
      expiresAt = (ent as { expires_at: string | null } | null)?.expires_at ?? null;
    }

    return { success: true, orderId: order.id, status: "paid", expiresAt };
  }

  // 5. Verify cryptographic signature (HMAC, timing-safe)
  const sigResult = verifyRazorpayPayment({
    orderId: input.razorpayOrderId,
    paymentId: input.razorpayPaymentId,
    signature: input.razorpaySignature,
  });
  if (!sigResult.valid) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Invalid payment signature");
  }

  // 6. Fetch authoritative Razorpay payment for amount/currency/status
  let fetched: { providerPaymentId: string; providerOrderId: string; amountMinor: number; currency: string; status: string };
  try {
    fetched = await fetchRazorpayPayment(input.razorpayPaymentId, deps?.razorpayClient ? { client: deps.razorpayClient } : undefined);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Payment verification failed: ${msg}`);
  }

  // 7. Validate amount/currency and order linkage
  if (fetched.providerOrderId !== input.razorpayOrderId) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Payment order mismatch");
  }
  if (fetched.amountMinor !== order.amount_minor) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Payment amount mismatch");
  }
  if (fetched.currency !== order.currency) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Payment currency mismatch");
  }
  if (fetched.status !== "captured" && fetched.status !== "authorized") {
    const { validationError } = await import("@/lib/errors");
    throw validationError(`Payment not captured: ${fetched.status}`);
  }

  // 8. Also verify amount via order snapshot vs payment — already done, no client trust

  // 9. Persist payment (before entitlement, inside same logical transaction)
  const { error: paymentError } = await admin.from("payments").insert({
    order_id: order.id,
    organization_id: order.organization_id,
    razorpay_payment_id: input.razorpayPaymentId,
    razorpay_signature: input.razorpaySignature,
    amount_minor: fetched.amountMinor,
    currency: fetched.currency,
    status: "captured",
    verified_at: new Date().toISOString(),
  });

  if (paymentError) {
    // Unique violation means race: another request inserted same payment concurrently
    if (paymentError.code === "23505") {
      // Treat as idempotent success
      const { data: ent } = await admin
        .from("tool_entitlements")
        .select("expires_at")
        .eq("organization_id", order.organization_id)
        .limit(1)
        .maybeSingle();
      return { success: true, orderId: order.id, status: "paid", expiresAt: (ent as { expires_at: string | null } | null)?.expires_at ?? null };
    }
    throw new Error(`Failed to persist payment: ${paymentError.message}`);
  }

  // 10. Update order status to paid
  const { error: orderUpdateError } = await admin.from("orders").update({ status: "paid" }).eq("id", order.id);
  if (orderUpdateError) throw new Error(`Failed to update order: ${orderUpdateError.message}`);

  // 11. Activate/renew entitlement
  // Need plan for billing_period
  const { data: plan } = await admin.from("plans").select("billing_period").eq("id", order.plan_id).single();
  if (!plan) throw new Error("Plan not found for order");

  const billingPeriod = plan.billing_period as BillingPeriod;
  const now = new Date();

  // Fetch existing entitlement (if any)
  let existingExpiresAt: Date | null = null;
  let existingId: string | null = null;

  if (order.is_all_access) {
    const { data: existing } = await admin
      .from("tool_entitlements")
      .select("id, expires_at")
      .eq("organization_id", order.organization_id)
      .eq("is_all_access", true)
      .maybeSingle();
    if (existing) {
      existingId = (existing as { id: string }).id;
      const exp = (existing as { expires_at: string | null }).expires_at;
      existingExpiresAt = exp ? new Date(exp) : null;
    }
  } else if (order.tool_id) {
    const { data: existing } = await admin
      .from("tool_entitlements")
      .select("id, expires_at")
      .eq("organization_id", order.organization_id)
      .eq("tool_id", order.tool_id)
      .maybeSingle();
    if (existing) {
      existingId = (existing as { id: string }).id;
      const exp = (existing as { expires_at: string | null }).expires_at;
      existingExpiresAt = exp ? new Date(exp) : null;
    }
  }

  // Handle NULL existing expiry (infinite promo/manual) — convert to finite paid
  // Spec says STOP unless service explicitly defines; we define as now+period and document
  const newExpiresAt = calculateRenewedExpiry(existingExpiresAt, now, billingPeriod);

  if (existingId) {
    const { error: entError } = await admin
      .from("tool_entitlements")
      .update({
        expires_at: newExpiresAt.toISOString(),
        source: "subscription",
      })
      .eq("id", existingId);
    if (entError) throw new Error(`Failed to update entitlement: ${entError.message}`);
  } else {
    const { error: entError } = await admin.from("tool_entitlements").insert({
      organization_id: order.organization_id,
      tool_id: order.is_all_access ? null : order.tool_id,
      is_all_access: order.is_all_access,
      source: "subscription",
      expires_at: newExpiresAt.toISOString(),
    });
    if (entError) throw new Error(`Failed to create entitlement: ${entError.message}`);
  }

  return { success: true, orderId: order.id, status: "paid", expiresAt: newExpiresAt.toISOString() };
}
