import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Billing exceptions — read-only detection over existing billing tables.
 * Only actionable exception states supported by the existing implementation.
 * All queries bounded and index-friendly (status indexes exist).
 */

const LIMIT = 50;
/** Orders in `created` older than this are considered stuck. */
export const STUCK_CREATED_AFTER_HOURS = 24;

export interface StuckOrder {
  id: string;
  organizationId: string;
  organizationName: string;
  amountMinor: number;
  currency: string;
  status: string;
  razorpayOrderId: string | null;
  createdAt: string;
  ageHours: number;
}

export interface ReplayCandidate {
  paymentId: string;
  razorpayPaymentId: string | null;
  orderId: string;
  orderStatus: string;
  organizationId: string;
  organizationName: string;
  amountMinor: number;
  currency: string;
  paymentStatus: string;
  orderAmountMinor: number | null;
  amountMatch: boolean | null;
  createdAt: string;
}

export interface OrphanWebhook {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string | null;
  status: string | null;
  createdAt: string;
}

export interface AmountMismatch {
  paymentId: string;
  orderId: string;
  organizationName: string;
  paymentAmountMinor: number;
  orderAmountMinor: number;
  paymentCurrency: string;
  orderCurrency: string;
  paymentStatus: string;
  orderStatus: string;
}

export interface BillingExceptionsResult {
  stuckOrders: StuckOrder[];
  replayCandidates: ReplayCandidate[];
  orphanWebhooks: OrphanWebhook[];
  amountMismatches: AmountMismatch[];
  stuckOrdersError?: string | undefined;
  replayError?: string | undefined;
  webhooksError?: string | undefined;
  mismatchError?: string | undefined;
}

export async function getBillingExceptions(): Promise<BillingExceptionsResult> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const result: BillingExceptionsResult = { stuckOrders: [], replayCandidates: [], orphanWebhooks: [], amountMismatches: [] };
  const cutoff = new Date(Date.now() - STUCK_CREATED_AFTER_HOURS * 3600 * 1000).toISOString();

  // 1. Stuck `created` orders (older than cutoff)
  try {
    const { data, error } = await admin
      .from("orders")
      .select("id, organization_id, amount_minor, currency, status, razorpay_order_id, created_at")
      .eq("status", "created")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(LIMIT);
    if (error) throw error;
    const rows = ((data ?? []) as Array<{
      id: string;
      organization_id: string;
      amount_minor: number;
      currency: string;
      status: string;
      razorpay_order_id: string | null;
      created_at: string;
    }>);
    const orgIds = [...new Set(rows.map((r) => r.organization_id))];
    const orgMap = new Map<string, string>();
    if (orgIds.length > 0) {
      const { data: orgData } = await admin.from("organizations").select("id, name").in("id", orgIds);
      for (const o of ((orgData ?? []) as Array<{ id: string; name: string }>)) orgMap.set(o.id, o.name);
    }
    const nowMs = Date.now();
    result.stuckOrders = rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      organizationName: orgMap.get(r.organization_id) ?? "Unknown",
      amountMinor: r.amount_minor,
      currency: r.currency,
      status: r.status,
      razorpayOrderId: r.razorpay_order_id,
      createdAt: r.created_at,
      ageHours: Math.round((nowMs - new Date(r.created_at).getTime()) / 3600000),
    }));
  } catch {
    result.stuckOrdersError = "Unable to load stuck orders.";
  }

  // 2. Captured/verified payments whose order is not paid (replay candidates)
  try {
    const { data, error } = await admin
      .from("payments")
      .select("id, order_id, organization_id, amount_minor, currency, status, razorpay_payment_id, created_at")
      .in("status", ["captured", "authorized"])
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (error) throw error;
    const rows = ((data ?? []) as Array<{
      id: string;
      order_id: string;
      organization_id: string;
      amount_minor: number;
      currency: string;
      status: string;
      razorpay_payment_id: string | null;
      created_at: string;
    }>);
    if (rows.length > 0) {
      const orderIds = [...new Set(rows.map((r) => r.order_id))];
      const orgIds = [...new Set(rows.map((r) => r.organization_id))];
      const [{ data: orderData }, { data: orgData }] = await Promise.all([
        admin.from("orders").select("id, status, amount_minor, currency").in("id", orderIds),
        admin.from("organizations").select("id, name").in("id", orgIds),
      ]);
      const orderMap = new Map(
        ((orderData ?? []) as Array<{ id: string; status: string; amount_minor: number; currency: string }>).map((o) => [o.id, o]),
      );
      const orgMap = new Map(((orgData ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]));
      for (const r of rows) {
        const order = orderMap.get(r.order_id);
        // Only surface where completion may need replay: order missing or not paid
        if (order && order.status === "paid") continue;
        result.replayCandidates.push({
          paymentId: r.id,
          razorpayPaymentId: r.razorpay_payment_id,
          orderId: r.order_id,
          orderStatus: order?.status ?? "order-not-found",
          organizationId: r.organization_id,
          organizationName: orgMap.get(r.organization_id) ?? "Unknown",
          amountMinor: r.amount_minor,
          currency: r.currency,
          paymentStatus: r.status,
          orderAmountMinor: order?.amount_minor ?? null,
          amountMatch: order ? order.amount_minor === r.amount_minor && order.currency === r.currency : null,
          createdAt: r.created_at,
        });
      }
    }
  } catch {
    result.replayError = "Unable to load replay candidates.";
  }

  // 3. Orphan / order-not-found webhook situations: failed razorpay webhooks (bounded)
  try {
    const { data, error } = await admin
      .from("webhook_events")
      .select("id, provider, provider_event_id, event_type, status, created_at")
      .eq("provider", "razorpay")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (error) throw error;
    result.orphanWebhooks = (((data ?? []) as Array<{
      id: string;
      provider: string;
      provider_event_id: string;
      event_type: string | null;
      status: string | null;
      created_at: string;
    }>)).map((r) => ({
      id: r.id,
      provider: r.provider,
      providerEventId: r.provider_event_id,
      eventType: r.event_type,
      status: r.status,
      createdAt: r.created_at,
    }));
  } catch {
    result.webhooksError = "Unable to load webhook exceptions.";
  }

  // 4. Amount/status inconsistencies: join recent payments vs orders in memory (bounded page)
  try {
    const { data, error } = await admin
      .from("payments")
      .select("id, order_id, organization_id, amount_minor, currency, status")
      .order("created_at", { ascending: false })
      .limit(LIMIT);
    if (error) throw error;
    const rows = ((data ?? []) as Array<{
      id: string;
      order_id: string;
      organization_id: string;
      amount_minor: number;
      currency: string;
      status: string;
    }>);
    if (rows.length > 0) {
      const orderIds = [...new Set(rows.map((r) => r.order_id))];
      const orgIds = [...new Set(rows.map((r) => r.organization_id))];
      const [{ data: orderData }, { data: orgData }] = await Promise.all([
        admin.from("orders").select("id, status, amount_minor, currency").in("id", orderIds),
        admin.from("organizations").select("id, name").in("id", orgIds),
      ]);
      const orderMap = new Map(
        ((orderData ?? []) as Array<{ id: string; status: string; amount_minor: number; currency: string }>).map((o) => [o.id, o]),
      );
      const orgMap = new Map(((orgData ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]));
      for (const r of rows) {
        const order = orderMap.get(r.order_id);
        if (!order) continue;
        if (order.amount_minor !== r.amount_minor || order.currency !== r.currency) {
          result.amountMismatches.push({
            paymentId: r.id,
            orderId: r.order_id,
            organizationName: orgMap.get(r.organization_id) ?? "Unknown",
            paymentAmountMinor: r.amount_minor,
            orderAmountMinor: order.amount_minor,
            paymentCurrency: r.currency,
            orderCurrency: order.currency,
            paymentStatus: r.status,
            orderStatus: order.status,
          });
        }
      }
    }
  } catch {
    result.mismatchError = "Unable to load amount mismatches.";
  }

  return result;
}
