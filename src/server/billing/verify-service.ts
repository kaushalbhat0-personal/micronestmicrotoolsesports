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

  // 1. Load MicroNest order — explicit projection (hot path)
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, organization_id, plan_id, tool_id, is_all_access, amount_minor, currency, razorpay_order_id, status")
    .eq("id", input.orderId)
    .single();
  if (orderError || !order) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Invalid order");
  }

  // 2. Verify organization ownership — server-authoritative tenant check
  await requireOrganizationMember((order as { organization_id: string }).organization_id);

  // 3. Verify Razorpay order match (server-side, not client trust)
  if ((order as { razorpay_order_id: string | null }).razorpay_order_id !== input.razorpayOrderId) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Razorpay order mismatch");
  }

  // 4. Verify cryptographic signature BEFORE idempotency check — security invariant
  const sigResult = verifyRazorpayPayment({
    orderId: input.razorpayOrderId,
    paymentId: input.razorpayPaymentId,
    signature: input.razorpaySignature,
  });
  if (!sigResult.valid) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Invalid payment signature");
  }

  // 5. Idempotency: if payment already captured for this razorpay_payment_id, return without re-extending
  const { data: existingPayment } = await admin
    .from("payments")
    .select("id, status")
    .eq("razorpay_payment_id", input.razorpayPaymentId)
    .maybeSingle();

  if (existingPayment) {
    // Scoped entitlement lookup — single query, not 3
    const ord = order as { organization_id: string; is_all_access: boolean; tool_id: string | null };
    let expiresAt: string | null = null;
    if (ord.is_all_access) {
      const { data: allEnt } = await admin
        .from("tool_entitlements")
        .select("expires_at")
        .eq("organization_id", ord.organization_id)
        .eq("is_all_access", true)
        .maybeSingle();
      expiresAt = (allEnt as { expires_at: string | null } | null)?.expires_at ?? null;
    } else if (ord.tool_id) {
      const { data: toolEnt } = await admin
        .from("tool_entitlements")
        .select("expires_at")
        .eq("organization_id", ord.organization_id)
        .eq("tool_id", ord.tool_id)
        .maybeSingle();
      expiresAt = (toolEnt as { expires_at: string | null } | null)?.expires_at ?? null;
    } else {
      // Fallback — all-access false with no tool_id (defensive)
      const { data: fallback } = await admin
        .from("tool_entitlements")
        .select("expires_at")
        .eq("organization_id", ord.organization_id)
        .eq("is_all_access", false)
        .maybeSingle();
      expiresAt = (fallback as { expires_at: string | null } | null)?.expires_at ?? null;
    }

    return { success: true, orderId: (order as { id: string }).id, status: "paid", expiresAt };
  }

  // 6. Fetch authoritative Razorpay payment and billing period in parallel (independent)
  let fetched: { providerPaymentId: string; providerOrderId: string; amountMinor: number; currency: string; status: string };
  let billingPeriod: BillingPeriod = "monthly";
  try {
    const [fetchedResult, planResult] = await Promise.all([
      fetchRazorpayPayment(input.razorpayPaymentId, deps?.razorpayClient ? { client: deps.razorpayClient } : undefined),
      admin.from("plans").select("billing_period").eq("id", (order as { plan_id: string }).plan_id).single(),
    ]);
    fetched = fetchedResult;
    const plan = (planResult as { data: { billing_period: string } | null }).data;
    if (plan) billingPeriod = (plan.billing_period as BillingPeriod) ?? "monthly";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Distinguish Razorpay fetch failure vs plan fetch failure
    if (msg.includes("Razorpay fetchPayment") || msg.includes("Razorpay")) {
      throw new Error(`Payment verification failed: ${msg}`);
    }
    throw new Error(`Payment verification failed: ${msg}`);
  }

  // 7. Validate amount/currency and order linkage
  if (fetched.providerOrderId !== input.razorpayOrderId) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Payment order mismatch");
  }
  if (fetched.amountMinor !== (order as { amount_minor: number }).amount_minor) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Payment amount mismatch");
  }
  if (fetched.currency !== (order as { currency: string }).currency) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Payment currency mismatch");
  }
  if (fetched.status !== "captured" && fetched.status !== "authorized") {
    const { validationError } = await import("@/lib/errors");
    throw validationError(`Payment not captured: ${fetched.status}`);
  }

  // 8. Atomic MicroNest DB transaction: payment + order + entitlement
  // Razorpay verification is outside the transaction (not part of DB); the DB changes are atomic via RPC
  const { data: rpcData, error: rpcError } = await admin.rpc("complete_billing_payment", {
    p_order_id: (order as { id: string }).id,
    p_razorpay_payment_id: input.razorpayPaymentId,
    p_razorpay_signature: input.razorpaySignature,
    p_amount_minor: fetched.amountMinor,
    p_currency: fetched.currency,
    p_verified_at: new Date().toISOString(),
    p_billing_period: billingPeriod,
  });

  if (rpcError) {
    // Unique violation — scoped expiry lookup (never unrestricted limit 1)
    if (rpcError.code === "23505" || rpcError.message?.includes("duplicate")) {
      const ord = order as { organization_id: string; is_all_access: boolean; tool_id: string | null };
      let scoped: { expires_at: string | null } | null = null;
      if (ord.is_all_access) {
        const { data: ent } = await admin
          .from("tool_entitlements")
          .select("expires_at")
          .eq("organization_id", ord.organization_id)
          .eq("is_all_access", true)
          .maybeSingle();
        scoped = ent as { expires_at: string | null } | null;
      } else if (ord.tool_id) {
        const { data: ent } = await admin
          .from("tool_entitlements")
          .select("expires_at")
          .eq("organization_id", ord.organization_id)
          .eq("tool_id", ord.tool_id)
          .eq("is_all_access", false)
          .maybeSingle();
        scoped = ent as { expires_at: string | null } | null;
      } else {
        const { data: ent } = await admin
          .from("tool_entitlements")
          .select("expires_at")
          .eq("organization_id", ord.organization_id)
          .eq("is_all_access", false)
          .maybeSingle();
        scoped = ent as { expires_at: string | null } | null;
      }
      return { success: true, orderId: (order as { id: string }).id, status: "paid", expiresAt: scoped?.expires_at ?? null };
    }
    throw new Error(`Failed to complete payment: ${rpcError.message}`);
  }

  const expiresAt = (rpcData as { expires_at: string | null } | null)?.expires_at ?? null;

  return {
    success: true,
    orderId: (order as { id: string }).id,
    status: "paid",
    expiresAt,
  };
}
