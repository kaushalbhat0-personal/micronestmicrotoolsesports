import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/get-user";
import { requireOrganizationMember } from "@/lib/auth/require-membership";
import { getPlanById } from "@/server/repositories/plans";
import { createRazorpayOrder } from "./razorpay";

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
  const user = await requireUser();
  // Verify organization membership — server-authoritative, prevents org spoof
  await requireOrganizationMember(input.organizationId);

  const supabase = await createClient();
  const plan = await getPlanById(supabase, input.planId);
  if (!plan || !plan.is_active) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Invalid or inactive plan");
  }

  const admin = createAdminClient();

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
      },
      deps?.razorpayClient ? { client: deps.razorpayClient } : undefined
    );

    // Persist razorpay_order_id server-side, never trust client
    const { error: updateError } = await admin
      .from("orders")
      .update({ razorpay_order_id: razorpayOrder.providerOrderId })
      .eq("id", orderId);

    if (updateError) throw new Error(`Failed to persist Razorpay order: ${updateError.message}`);

    const keyId = process.env.RAZORPAY_KEY_ID ?? null;

    return {
      orderId,
      razorpayOrderId: razorpayOrder.providerOrderId,
      amountMinor: plan.amount_minor,
      currency: plan.currency,
      keyId,
    };
  } catch (err) {
    // Deterministic failure: mark order failed, no entitlement, no payment
    await admin.from("orders").update({ status: "failed" }).eq("id", orderId);
    throw err;
  }
}
