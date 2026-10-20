import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/get-user";
import { requireOrganizationRole } from "@/lib/auth/require-membership";
import { getPlanById } from "@/server/repositories/plans";
import {
  createDodoCheckoutSession,
  isSupportedBillingCurrency,
  validateDodoProduct,
  type DodoClientLike,
} from "./dodo";
import { getDodoConfig, getDodoProductIdForPlanSlug } from "@/server/integrations/dodo/client";

export type CheckoutInput = {
  planId: string;
  organizationId: string;
};

export type CheckoutResult = {
  orderId: string;
  /** Active provider for this order (dodo for new purchases; razorpay dormant). */
  provider: "dodo";
  /** Hosted Dodo checkout URL — redirect the buyer here. */
  checkoutUrl: string;
  dodoSessionId: string;
  amountMinor: number;
  currency: string;
};

export async function createCheckoutOrder(
  input: CheckoutInput,
  deps?: {
    dodoClient?: DodoClientLike;
  }
): Promise<CheckoutResult> {
  // Buyer attribution (Phase 4): the authenticated purchaser is the buyer.
  // Never accepted from client input — CheckoutInput has no buyer field.
  const user = await requireUser();
  // Paid purchases move organization money: Owner/Admin only (RCCF-ORG-MEMBERS-01).
  // Free claims stay member-accessible (freemium); billing reads stay open.
  await requireOrganizationRole(input.organizationId, ["owner", "admin"]);

  // Use admin client for plan lookup (authoritative catalog, no RLS variance)
  // Tenant check already done via requireOrganizationMember; plan is global catalog.
  const admin = createAdminClient();
  const plan = await getPlanById(admin, input.planId);
  if (!plan || !plan.is_active) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Invalid or inactive plan");
  }

  // Fail-fast: validate Dodo config BEFORE creating internal order
  // If Dodo is not configured and no test double is provided, do not create audit noise.
  const dodoCfg = getDodoConfig();
  if (!dodoCfg && !deps?.dodoClient) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Payment not configured");
  }

  // Snapshot from plan — server-authoritative, client never provides amount/currency/tool.
  // The market is DERIVED from the authoritative plan currency: INR = India,
  // USD = international (Sponsorship Tracking only in V1). There is no country
  // input anywhere in this flow, so a client cannot pick a market or price.
  const isAllAccess = plan.tool_id === null;
  const toolId = plan.tool_id;

  // V1 supports INR (India) and USD (international Sponsorship Tracking).
  // Anything else fails closed — the client cannot influence this value.
  if (!isSupportedBillingCurrency(plan.currency)) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Unsupported billing currency");
  }

  // V1 scope guard: USD purchasing exists only for Sponsorship Tracking.
  // INR plans keep their existing behavior unchanged.
  if (plan.currency === "USD" && plan.tool_id === null) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Unsupported billing currency for this plan");
  }

  // Resolve Dodo product from plan slug — server-side, never client input.
  // Missing mapping fails closed BEFORE any order is created.
  const productId = getDodoProductIdForPlanSlug(plan.slug);
  if (!productId) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Payment not configured for this plan");
  }

  // Targeted product validation: only the product required for THIS checkout
  // is validated (existence, one-time semantics, currency, amount). One
  // misconfigured unrelated product can never block other plans, and an
  // invalid product here fails closed before any order is created.
  const productCheck = await validateDodoProduct(
    {
      productId,
      amountMinor: plan.amount_minor,
      currency: plan.currency,
      billingPeriod: plan.billing_period,
    },
    deps?.dodoClient ? { client: deps.dodoClient } : undefined
  );
  if (!productCheck.valid) {
    const { validationError } = await import("@/lib/errors");
    throw validationError("Payment not configured for this plan");
  }

  // Create MicroNest order first (audit history, even if Dodo fails)
  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      organization_id: input.organizationId,
      plan_id: plan.id,
      tool_id: toolId,
      is_all_access: isAllAccess,
      buyer_user_id: user.id,
      amount_minor: plan.amount_minor,
      currency: plan.currency,
      status: "created",
      provider: "dodo",
    })
    .select("id")
    .single();

  if (orderError || !order) {
    throw new Error(`Failed to create order: ${orderError?.message ?? "unknown"}`);
  }

  const orderId = order.id as string;

  // Buyer email for the Dodo customer record — server-derived from auth, never client input
  const buyerEmail =
    (user as { email?: string | null }).email ?? (user as { primaryEmail?: string | null }).primaryEmail ?? null;

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const returnUrl = getDodoConfig()?.returnUrl ?? (origin ? `${origin.replace(/\/$/, "")}/billing/return` : "");
  if (!returnUrl) {
    await admin.from("orders").update({ status: "failed" }).eq("id", orderId);
    throw new Error("Dodo return URL not configured — missing DODO_PAYMENTS_RETURN_URL");
  }

  try {
    const dodoSession = await createDodoCheckoutSession(
      {
        amountMinor: plan.amount_minor,
        currency: plan.currency,
        productId,
        customerEmail: buyerEmail ?? `org-${input.organizationId}@micronest.local`,
        orderId,
        organizationId: input.organizationId,
        planSlug: plan.slug,
        returnUrl: `${returnUrl}?orderId=${orderId}`,
      },
      deps?.dodoClient ? { client: deps.dodoClient } : undefined
    );

    // Persist provider refs server-side, never trust client
    const { error: updateError } = await admin
      .from("orders")
      .update({ provider: "dodo", dodo_session_id: dodoSession.sessionId })
      .eq("id", orderId);

    if (updateError) throw new Error(`Failed to persist Dodo session: ${updateError.message}`);

    return {
      orderId,
      provider: "dodo" as const,
      checkoutUrl: dodoSession.checkoutUrl,
      dodoSessionId: dodoSession.sessionId,
      amountMinor: plan.amount_minor,
      currency: plan.currency,
    };
  } catch (err) {
    // Deterministic failure: mark order failed, no entitlement, no payment
    await admin.from("orders").update({ status: "failed" }).eq("id", orderId);
    throw err;
  }
}
