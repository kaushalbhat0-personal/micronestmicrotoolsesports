import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/get-user";
import { requireOrganizationMember } from "@/lib/auth/require-membership";
import { verifyRazorpayPayment, fetchRazorpayPayment, type RazorpayClientLike } from "./razorpay";
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

  // 8. Atomic MicroNest DB transaction: payment + order + entitlement
  // Razorpay verification is outside the transaction (not part of DB); the DB changes are atomic via RPC
  const { data: plan } = await admin.from("plans").select("billing_period").eq("id", order.plan_id).single();
  if (!plan) throw new Error("Plan not found for order");
  const billingPeriod = (plan.billing_period as BillingPeriod) ?? "monthly";

  const { data: rpcData, error: rpcError } = await admin.rpc("complete_billing_payment", {
    p_order_id: order.id,
    p_razorpay_payment_id: input.razorpayPaymentId,
    p_razorpay_signature: input.razorpaySignature,
    p_amount_minor: fetched.amountMinor,
    p_currency: fetched.currency,
    p_verified_at: new Date().toISOString(),
    p_billing_period: billingPeriod,
  });

  if (rpcError) {
    // Unique violation or other — treat duplicate payment as idempotent if it matches existing payment
    if (rpcError.code === "23505" || rpcError.message?.includes("duplicate")) {
      const { data: ent } = await admin
        .from("tool_entitlements")
        .select("expires_at")
        .eq("organization_id", order.organization_id)
        .limit(1)
        .maybeSingle();
      return { success: true, orderId: order.id, status: "paid", expiresAt: (ent as { expires_at: string | null } | null)?.expires_at ?? null };
    }
    throw new Error(`Failed to complete payment: ${rpcError.message}`);
  }

  const expiresAt = (rpcData as { expires_at: string | null } | null)?.expires_at ?? null;

  return {
    success: true,
    orderId: order.id,
    status: "paid",
    expiresAt,
  };
}
