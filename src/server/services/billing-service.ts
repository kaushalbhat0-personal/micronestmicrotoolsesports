import type { SupabaseClient } from "@supabase/supabase-js";
import { listActivePlans } from "@/server/repositories/plans";
import { listOrdersForOrg } from "@/server/repositories/orders";
import { listPaymentsForOrg } from "@/server/repositories/payments";
import { listEntitlementsForOrg } from "@/server/repositories/entitlements";
import { TOOLS } from "@/config/app/tools";
import type { Plan, Order, Payment, ToolEntitlement } from "@/types/database";

export type BillingEntitlementView = {
  toolSlug: string | null;
  toolName: string;
  isAllAccess: boolean;
  source: string;
  expiresAt: string | null;
  status: "permanent" | "active" | "expiring_soon" | "expired" | "none";
};

export type BillingHistoryEntry = {
  id: string;
  date: string;
  planName: string;
  planSlug: string;
  billingPeriod: string;
  amountMinor: number;
  currency: string;
  status: string;
  razorpayPaymentId: string | null;
};

export type BillingOverview = {
  entitlements: BillingEntitlementView[];
  plans: Plan[];
  orders: Order[];
  payments: Payment[];
  history: BillingHistoryEntry[];
  currentPlan: Plan | null;
};

export async function getBillingOverview(supabase: SupabaseClient, organizationId: string): Promise<BillingOverview> {
  const [entitlements, plans, orders, payments] = await Promise.all([
    listEntitlementsForOrg(supabase, organizationId),
    listActivePlans(supabase),
    listOrdersForOrg(supabase, organizationId),
    listPaymentsForOrg(supabase, organizationId),
  ]);

  const toolMap = new Map(TOOLS.map((t) => [t.slug, t]));
  // Also map by tool id via tools table if needed — for now use slug via entitlements join
  const entViews: BillingEntitlementView[] = [];

  for (const ent of entitlements as unknown as (ToolEntitlement & { tool?: { slug: string; name: string } })[]) {
    const isAllAccess = ent.is_all_access;
    let toolSlug: string | null = null;
    let toolName = "All Access";
    if (!isAllAccess && ent.tool_id) {
      // Find tool by id via tool relation if available
      const tool = (ent as unknown as { tool?: { slug: string; name: string } }).tool;
      if (tool) {
        toolSlug = tool.slug;
        toolName = tool.name;
      } else {
        // Fallback to lookup via TOOLS by matching name? Use generic
        toolSlug = "unknown";
        toolName = "Unknown Tool";
      }
    } else if (!isAllAccess) {
      toolSlug = null;
      toolName = "Unknown";
    }

    // Determine status
    let status: BillingEntitlementView["status"] = "none";
    if (!ent.expires_at) status = "permanent";
    else {
      const exp = new Date(ent.expires_at);
      const now = new Date();
      const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (exp <= now) status = "expired";
      else if (diffDays <= 7) status = "expiring_soon";
      else status = "active";
    }

    entViews.push({
      toolSlug,
      toolName,
      isAllAccess,
      source: ent.source,
      expiresAt: ent.expires_at,
      status,
    });
  }

  // Current plan — most recent paid order's plan, if any
  let currentPlan: Plan | null = null;
  const paidOrders = orders.filter((o) => o.status === "paid").sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (paidOrders.length > 0) {
    const latestPaid = paidOrders[0];
    if (latestPaid) {
      currentPlan = plans.find((p) => p.id === latestPaid.plan_id) ?? null;
    }
  }

  // Billing history: merge orders + payments, prefer payment date where available
  const paymentByOrder = new Map(payments.map((p) => [p.order_id, p]));
  const history: BillingHistoryEntry[] = orders
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)
    .map((order) => {
      const plan = plans.find((p) => p.id === order.plan_id);
      const payment = paymentByOrder.get(order.id);
      return {
        id: order.id,
        date: payment?.created_at ?? order.created_at,
        planName: plan?.name ?? "Unknown Plan",
        planSlug: plan?.slug ?? "unknown",
        billingPeriod: plan?.billing_period ?? "monthly",
        amountMinor: order.amount_minor,
        currency: order.currency,
        status: payment?.status ?? order.status,
        razorpayPaymentId: payment?.razorpay_payment_id ?? null,
      };
    });

  return { entitlements: entViews, plans, orders, payments, history, currentPlan };
}
