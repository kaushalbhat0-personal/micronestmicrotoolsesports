import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/get-user";
import { requireOrganizationMember } from "@/lib/auth/require-membership";
import { getPlanById } from "@/server/repositories/plans";
import { createRazorpayOrder } from "./razorpay";
import { getRazorpayConfig } from "@/server/integrations/razorpay/client";

// Hardcoded server constants — never client-controlled
export const LIVE_TEST_AMOUNT_MINOR = 100; // ₹1
export const LIVE_TEST_CURRENCY = "INR" as const;

export const LIVE_TEST_PLAN_IDS = [
  "a1b2c3d4-1234-1234-1234-000000000001", // sponsorship-tracking-monthly
  "a1b2c3d4-1234-1234-1234-000000000002", // sponsorship-tracking-yearly
  "a1b2c3d4-1234-1234-1234-000000000003", // prize-pool-splitter-monthly
  "a1b2c3d4-1234-1234-1234-000000000004", // prize-pool-splitter-yearly
  "a1b2c3d4-1234-1234-1234-000000000005", // all-access-monthly
  "a1b2c3d4-1234-1234-1234-000000000006", // all-access-yearly
] as const;

export type LiveTestPlanId = (typeof LIVE_TEST_PLAN_IDS)[number];

export type LiveTestCheckoutResult = {
  orderId: string;
  razorpayOrderId: string;
  amountMinor: number;
  currency: string;
  keyId: string | null;
  planId: string;
  isLiveTest: true;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isLiveTestEnabled(): boolean {
  return process.env.BILLING_LIVE_TEST_ENABLED === "true";
}

export function getLiveTestConfig(): {
  enabled: boolean;
  orgId: string | null;
  userEmail: string | null;
} {
  return {
    enabled: isLiveTestEnabled(),
    orgId: process.env.BILLING_LIVE_TEST_ORG_ID ?? null,
    userEmail: process.env.BILLING_LIVE_TEST_USER_EMAIL
      ? normalizeEmail(process.env.BILLING_LIVE_TEST_USER_EMAIL)
      : null,
  };
}

export async function createLiveTestCheckoutOrder(
  input: { planId: string },
  deps?: {
    razorpayClient?: Parameters<typeof createRazorpayOrder>[1] extends { client?: infer C } ? C : never;
  }
): Promise<LiveTestCheckoutResult> {
  // 1. Feature flag — fail closed
  if (!isLiveTestEnabled()) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Live test mode disabled");
  }

  const testOrgId = process.env.BILLING_LIVE_TEST_ORG_ID;
  const testUserEmailRaw = process.env.BILLING_LIVE_TEST_USER_EMAIL;
  if (!testOrgId || !testUserEmailRaw) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Live test not configured");
  }
  const testUserEmail = normalizeEmail(testUserEmailRaw);

  // 2. Require authenticated user — never trust client email
  const user = await requireUser();
  const userEmail = normalizeEmail((user as { email?: string | null }).email ?? "");
  if (!userEmail || userEmail !== testUserEmail) {
    const { forbiddenError } = await import("@/lib/errors");
    throw forbiddenError("Not authorized for live test");
  }

  // 3. Require owner role on allowlisted org
  const membershipCtx = await requireOrganizationMember(testOrgId);
  if (membershipCtx.membership.role !== "owner") {
    const { forbiddenError } = await import("@/lib/errors");
    throw forbiddenError("Live test requires owner role");
  }

  // 4. Plan allowlist — only six canonical IDs
  if (!LIVE_TEST_PLAN_IDS.includes(input.planId as LiveTestPlanId)) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Plan not allowlisted for live test");
  }

  // 5. Load authoritative commercial plan — must remain is_active and unchanged
  const admin = createAdminClient();
  const plan = await getPlanById(admin, input.planId);
  if (!plan || !plan.is_active) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Invalid or inactive plan");
  }
  if (plan.currency !== "INR") {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Live test supports INR only");
  }

  // 6. Single-use protection — at most one paid live-test per org+plan
  const { data: existingPaid } = await admin
    .from("orders")
    .select("id")
    .eq("organization_id", testOrgId)
    .eq("plan_id", plan.id)
    .eq("is_live_test", true)
    .eq("status", "paid")
    .maybeSingle();
  if (existingPaid) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Live test already completed for this plan");
  }

  // 7. Fail-fast: validate Razorpay config BEFORE creating internal order
  const razorpayCfg = getRazorpayConfig();
  if (!razorpayCfg && !deps?.razorpayClient) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Payment not configured");
  }

  const isAllAccess = plan.tool_id === null;
  const toolId = plan.tool_id;

  // 8. Create order snapshot with hardcoded ₹1 — commercial plan price NOT used
  // Buyer attribution (Phase 4): the authenticated live-test owner is the buyer.
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      organization_id: testOrgId,
      plan_id: plan.id,
      tool_id: toolId,
      is_all_access: isAllAccess,
      buyer_user_id: user.id,
      amount_minor: LIVE_TEST_AMOUNT_MINOR,
      currency: LIVE_TEST_CURRENCY,
      status: "created",
      is_live_test: true,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    throw new Error(`Failed to create live-test order: ${orderError?.message ?? "unknown"}`);
  }

  const orderId = (order as { id: string }).id;

  try {
    const razorpayOrder = await createRazorpayOrder(
      {
        amountMinor: LIVE_TEST_AMOUNT_MINOR,
        currency: LIVE_TEST_CURRENCY,
        receipt: orderId,
        notes: {
          product_type: "software_subscription",
          billing_period: plan.billing_period,
          plan_slug: plan.slug,
          tool: isAllAccess ? "all_access" : (plan.tool_id ?? "unknown"),
          business: "MicroNest — subscription software for esports operations",
          test_mode: "true",
          original_amount_minor: String(plan.amount_minor),
          plan_id: plan.id,
        },
      },
      deps?.razorpayClient ? { client: deps.razorpayClient } : undefined
    );

    const { error: updateError } = await admin
      .from("orders")
      .update({ razorpay_order_id: razorpayOrder.providerOrderId })
      .eq("id", orderId);

    if (updateError) throw new Error(`Failed to persist Razorpay order: ${updateError.message}`);

    const resolvedKeyId = getRazorpayConfig()?.keyId ?? process.env.RAZORPAY_KEY_ID ?? null;

    return {
      orderId,
      razorpayOrderId: razorpayOrder.providerOrderId,
      amountMinor: LIVE_TEST_AMOUNT_MINOR,
      currency: LIVE_TEST_CURRENCY,
      keyId: resolvedKeyId,
      planId: plan.id,
      isLiveTest: true as const,
    };
  } catch (err) {
    await admin.from("orders").update({ status: "failed" }).eq("id", orderId);
    throw err;
  }
}
