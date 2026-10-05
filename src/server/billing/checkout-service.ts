import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/get-user";
import { requireOrganizationMember } from "@/lib/auth/require-membership";
import { getPlanById } from "@/server/repositories/plans";
import { createRazorpayOrder } from "./razorpay";
import { getRazorpayConfig } from "@/server/integrations/razorpay/client";

export type CheckoutInput = {
  planId: string;
  organizationId: string;
};

export type CheckoutResult = {
  orderId: string;
  razorpayOrderId: string;
  amountMinor: number;
  currency: string;
  keyId: string | null;
};

export async function createCheckoutOrder(
  input: CheckoutInput,
  deps?: {
    razorpayClient?: Parameters<typeof createRazorpayOrder>[1] extends { client?: infer C } ? C : never;
  }
): Promise<CheckoutResult> {
  const _user = await requireUser();
  void _user;
  // Verify organization membership — server-authoritative, prevents org spoof
  await requireOrganizationMember(input.organizationId);

  // Use admin client for plan lookup (authoritative catalog, no RLS variance)
  // Tenant check already done via requireOrganizationMember; plan is global catalog.
  const admin = createAdminClient();
  const plan = await getPlanById(admin, input.planId);
  if (!plan || !plan.is_active) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Invalid or inactive plan");
  }

  // Fail-fast: validate Razorpay config BEFORE creating internal order
  // If Razorpay is not configured and no test double is provided, do not create audit noise.
  const razorpayCfg = getRazorpayConfig();
  if (!razorpayCfg && !deps?.razorpayClient) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Payment not configured");
  }

  // Snapshot from plan — server-authoritative, client never provides amount/currency/tool
  const isAllAccess = plan.tool_id === null;
  const toolId = plan.tool_id;

  // Create MicroNest order first (audit history, even if Razorpay fails)
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      organization_id: input.organizationId,
      plan_id: plan.id,
      tool_id: toolId,
      is_all_access: isAllAccess,
      amount_minor: plan.amount_minor,
      currency: plan.currency,
      status: "created",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    throw new Error(`Failed to create order: ${orderError?.message ?? "unknown"}`);
  }

  const orderId = order.id as string;

  try {
    const razorpayOrder = await createRazorpayOrder(
      {
        amountMinor: plan.amount_minor,
        currency: plan.currency,
        receipt: orderId,
        notes: {
          product_type: "software_subscription",
          billing_period: plan.billing_period,
          plan_slug: plan.slug,
          tool: isAllAccess ? "all_access" : (plan.tool_id ?? "unknown"),
          business: "MicroNest — subscription software for esports operations",
        },
      },
      deps?.razorpayClient ? { client: deps.razorpayClient } : undefined
    );

    // Persist razorpay_order_id server-side, never trust client
    const { error: updateError } = await admin
      .from("orders")
      .update({ razorpay_order_id: razorpayOrder.providerOrderId })
      .eq("id", orderId);

    if (updateError) throw new Error(`Failed to persist Razorpay order: ${updateError.message}`);

    const resolvedKeyId = getRazorpayConfig()?.keyId ?? process.env.RAZORPAY_KEY_ID ?? null;

    return {
      orderId,
      razorpayOrderId: razorpayOrder.providerOrderId,
      amountMinor: plan.amount_minor,
      currency: plan.currency,
      keyId: resolvedKeyId,
    };
  } catch (err) {
    // Deterministic failure: mark order failed, no entitlement, no payment
    await admin.from("orders").update({ status: "failed" }).eq("id", orderId);
    throw err;
  }
}
