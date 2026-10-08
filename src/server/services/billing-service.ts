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

/** One card in "Your Tools" — derived from an authoritative entitlement row. */
export type BillingToolCard = {
  toolSlug: string;
  displayName: string;
  description: string;
  icon: string;
  status: BillingEntitlementView["status"];
  expiresAt: string | null;
  /** True when access flows through All Access rather than a per-tool purchase. */
  viaAllAccess: boolean;
};

/** One card in "Available to Add" — derived from registry × active plans. */
export type BillingAvailableCard = {
  toolSlug: string;
  displayName: string;
  description: string;
  icon: string;
  monthly: { planId: string; amountMinor: number; currency: string } | null;
  yearly: { planId: string; amountMinor: number; currency: string } | null;
};

type DiscoveryInput = {
  entitlements: BillingEntitlementView[];
  plans: Pick<Plan, "id" | "tool_id" | "billing_period" | "amount_minor" | "currency" | "is_active">[];
  tools: { id: string; slug: string; is_active: boolean }[];
};

/**
 * Derive the two billing discovery collections. Pure business logic (testable).
 *
 * - Your Tools: commercially available registry tools with an ACTIVE
 *   (permanent/active/expiring_soon) entitlement. Expired rows are excluded.
 *   An active All Access row expands to every commercial tool not otherwise
 *   covered, marked viaAllAccess with the All Access expiry.
 * - Available to Add: commercial registry tools with ≥1 active plan that are
 *   NOT in Your Tools. Coming-soon tools never qualify (registry flag), and
 *   tools without plans cannot be purchased so they are excluded.
 * No database IDs, UUIDs, or source enums leak into the cards.
 */
export function buildBillingToolSections(input: DiscoveryInput): { yourTools: BillingToolCard[]; availableToAdd: BillingAvailableCard[] } {
  const commercial = TOOLS.filter((t) => !t.comingSoon);
  const toolIdBySlug = new Map(input.tools.filter((t) => t.is_active).map((t) => [t.slug, t.id]));
  const activeEnts = input.entitlements.filter((e) => e.status === "permanent" || e.status === "active" || e.status === "expiring_soon");
  const perTool = new Map<string, BillingEntitlementView>();
  for (const e of activeEnts) {
    if (!e.isAllAccess && e.toolSlug) perTool.set(e.toolSlug, e);
  }
  const allAccessEnt = activeEnts.find((e) => e.isAllAccess);

  const yourTools: BillingToolCard[] = [];
  for (const cfg of commercial) {
    const direct = perTool.get(cfg.slug);
    if (direct) {
      yourTools.push({
        toolSlug: cfg.slug,
        displayName: cfg.name,
        description: cfg.description,
        icon: cfg.icon,
        status: direct.status,
        expiresAt: direct.expiresAt,
        viaAllAccess: false,
      });
    } else if (allAccessEnt) {
      yourTools.push({
        toolSlug: cfg.slug,
        displayName: cfg.name,
        description: cfg.description,
        icon: cfg.icon,
        status: allAccessEnt.status,
        expiresAt: allAccessEnt.expiresAt,
        viaAllAccess: true,
      });
    }
  }

  const covered = new Set(yourTools.map((t) => t.toolSlug));
  const availableToAdd: BillingAvailableCard[] = [];
  for (const cfg of commercial) {
    if (covered.has(cfg.slug)) continue;
    const toolId = toolIdBySlug.get(cfg.slug);
    if (!toolId) continue;
    const toolPlans = input.plans.filter((p) => p.tool_id === toolId && p.is_active !== false);
    if (toolPlans.length === 0) continue;
    const pick = (period: string) => {
      const p = toolPlans.find((x) => x.billing_period === period);
      return p ? { planId: p.id, amountMinor: p.amount_minor, currency: p.currency } : null;
    };
    availableToAdd.push({
      toolSlug: cfg.slug,
      displayName: cfg.name,
      description: cfg.description,
      icon: cfg.icon,
      monthly: pick("monthly"),
      yearly: pick("yearly"),
    });
  }

  return { yourTools, availableToAdd };
}

/** Server wrapper: overview + tools catalog → discovery view model. */
export async function getBillingToolSections(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ yourTools: BillingToolCard[]; availableToAdd: BillingAvailableCard[] }> {
  const overview = await getBillingOverview(supabase, organizationId);
  const { data: tools } = await supabase.from("tools").select("id, slug, is_active");
  return buildBillingToolSections({
    entitlements: overview.entitlements,
    plans: overview.plans,
    tools: ((tools ?? []) as { id: string; slug: string; is_active: boolean }[]).filter((t) => typeof t.slug === "string"),
  });
}
