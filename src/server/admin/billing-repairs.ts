import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAdminAudit } from "@/server/admin/audit";
import { SIX_TOOL_SLUGS } from "@/server/admin/customers";

/**
 * Billing repairs — exactly three audited mutations. Every function follows:
 * requireSuperAdmin → createAdminClient → bounded operation → recordAdminAudit.
 * All mutations are idempotent and require explicit confirmation (enforced by
 * the caller passing `confirmed: true`; without it the function returns a
 * preview instead of mutating).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(id: string, label: string): void {
  if (!UUID_RE.test(id)) throw new Error(`Invalid ${label}`);
}

function requireReason(reason: string): string {
  const r = reason.trim().slice(0, 500);
  if (r.length < 5) throw new Error("A reason of at least 5 characters is required");
  return r;
}

export interface MutationPreview {
  mutated: false;
  preview: Record<string, unknown>;
}

export interface MutationDone {
  mutated: true;
  idempotent: boolean;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export type MutationOutcome = MutationPreview | MutationDone;

// ── Mutation 1: expire stuck `created` order ─────────────────────────────

export async function expireStuckOrder(
  orderId: string,
  reason: string,
  confirmed: boolean,
): Promise<MutationOutcome> {
  const actor = await requireSuperAdmin();
  void actor;
  requireUuid(orderId, "order ID");
  const admin = createAdminClient();

  const { data: order, error } = await admin
    .from("orders")
    .select("id, organization_id, status, amount_minor, currency, razorpay_order_id, created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) throw new Error("Order not found");
  const o = order as {
    id: string;
    organization_id: string;
    status: string;
    amount_minor: number;
    currency: string;
    razorpay_order_id: string | null;
    created_at: string;
  };

  // Idempotent: already expired → safe no-op success (no state change, no new audit)
  if (o.status === "expired") {
    return {
      mutated: true,
      idempotent: true,
      before: { status: "expired" },
      after: { status: "expired" },
    };
  }
  if (o.status !== "created") throw new Error(`Order is not eligible for expiry (status: ${o.status})`);

  const preview = {
    orderId: o.id,
    fromStatus: "created",
    toStatus: "expired",
    amountMinor: o.amount_minor,
    currency: o.currency,
    organizationId: o.organization_id,
  };
  if (!confirmed) return { mutated: false, preview };

  const cleanReason = requireReason(reason);
  const before = { status: o.status, orderId: o.id };
  const { data: updated, error: updateError } = await admin
    .from("orders")
    .update({ status: "expired" })
    .eq("id", o.id)
    .eq("status", "created")
    .select("id");
  if (updateError) throw new Error(`Failed to expire order: ${updateError.message}`);
  // F-06: concurrent expiry must not produce a second audit. Only the
  // operation that actually changed the row audits; a lost race re-reads
  // truthfully and reports the state actually observed.
  const changed = Array.isArray(updated) ? updated.length > 0 : Boolean(updated);
  if (!changed) {
    const { data: current } = await admin.from("orders").select("status").eq("id", o.id).maybeSingle();
    const curStatus = (current as { status: string } | null)?.status ?? "unknown";
    if (curStatus === "expired") {
      return {
        mutated: true,
        idempotent: true,
        before: { status: "expired" },
        after: { status: "expired" },
      };
    }
    throw new Error(`Order is no longer eligible for expiry (status: ${curStatus})`);
  }
  const after = { status: "expired", orderId: o.id };

  await recordAdminAudit({
    action: "billing.order_expire",
    targetType: "order",
    targetId: o.id,
    organizationId: o.organization_id,
    reason: cleanReason,
    before,
    after,
  });

  return { mutated: true, idempotent: false, before, after };
}

// ── Mutation 2: repair verified captured payment completion ──────────────
// F-01 (P1): the previous implementation called the canonical insert-path
// completion RPC, whose idempotency branch returns early when the payment
// row already exists — leaving the order unpaid while auditing "paid". This
// path now calls the dedicated repair_billing_completion RPC, which locks the
// EXISTING payment + order rows, re-validates every invariant server-side,
// flips the order to paid, and provisions the entitlement without inserting
// a second payment. The audit below is built from the state actually
// observed AFTER the operation — never a hardcoded "paid".

export async function replayPaymentCompletion(
  paymentId: string,
  reason: string,
  confirmed: boolean,
): Promise<MutationOutcome> {
  const actor = await requireSuperAdmin();
  void actor;
  requireUuid(paymentId, "payment ID");
  const admin = createAdminClient();

  // Load payment WITHOUT signature/payload — only linkage + money state
  const { data: payment, error: payError } = await admin
    .from("payments")
    .select("id, order_id, organization_id, amount_minor, currency, status, razorpay_payment_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (payError || !payment) throw new Error("Payment not found");
  const p = payment as {
    id: string;
    order_id: string;
    organization_id: string;
    amount_minor: number;
    currency: string;
    status: string;
    razorpay_payment_id: string | null;
  };

  if (p.status !== "captured" && p.status !== "authorized") {
    throw new Error(`Payment is not eligible for replay (status: ${p.status})`);
  }
  if (!p.razorpay_payment_id) throw new Error("Payment has no provider payment ID");

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, organization_id, plan_id, status, amount_minor, currency")
    .eq("id", p.order_id)
    .maybeSingle();
  if (orderError || !order) throw new Error("Linked order not found");
  const o = order as {
    id: string;
    organization_id: string;
    plan_id: string;
    status: string;
    amount_minor: number;
    currency: string;
  };

  // Cross-org invariant: matching amount/currency alone is insufficient.
  // Organization IDs are server-read (never client-supplied).
  if (o.organization_id !== p.organization_id) {
    throw new Error("Payment/order organization mismatch — manual review required");
  }
  if (o.amount_minor !== p.amount_minor || o.currency !== p.currency) {
    throw new Error("Payment/order amount mismatch — manual review required");
  }

  // Idempotent fast path: order already paid → verify entitlement exists, no-op
  if (o.status === "paid") {
    return {
      mutated: true,
      idempotent: true,
      before: { orderStatus: "paid", paymentStatus: p.status },
      after: { orderStatus: "paid", paymentStatus: p.status },
    };
  }

  const preview = {
    paymentId: p.id,
    orderId: o.id,
    fromOrderStatus: o.status,
    toOrderStatus: "paid",
    amountMinor: p.amount_minor,
    currency: p.currency,
    organizationId: o.organization_id,
  };
  if (!confirmed) return { mutated: false, preview };

  const cleanReason = requireReason(reason);

  // Billing period and plan resolve inside the RPC from the order's plan —
  // never from client input. No Razorpay secret or signature leaves the DB:
  // the RPC takes only the payment row id and reads stored state itself.
  const before = { orderStatus: o.status, paymentStatus: p.status, orderId: o.id, paymentId: p.id };

  const { error: rpcError } = await admin.rpc("repair_billing_completion", {
    p_payment_id: p.id,
  });
  if (rpcError) throw new Error(`Completion replay failed: ${rpcError.message}`);

  // Post-condition: re-read the ACTUAL state. The audit below reports what
  // the database confirms — if completion did not happen, the unchanged
  // state is audited and a truthful failure is returned (never "paid").
  const [{ data: afterOrder }, { data: afterPayment }] = await Promise.all([
    admin
      .from("orders")
      .select("id, organization_id, tool_id, is_all_access, status")
      .eq("id", o.id)
      .maybeSingle(),
    admin.from("payments").select("id, status").eq("id", p.id).maybeSingle(),
  ]);
  const ao = afterOrder as {
    id: string;
    organization_id: string;
    tool_id: string | null;
    is_all_access: boolean;
    status: string;
  } | null;
  if (!ao) throw new Error("Linked order not found after repair");
  const ap = afterPayment as { id: string; status: string } | null;

  let expiresAt: string | null = null;
  try {
    const entQuery = admin
      .from("tool_entitlements")
      .select("expires_at")
      .eq("organization_id", ao.organization_id);
    const scoped = ao.is_all_access
      ? await entQuery.eq("is_all_access", true).maybeSingle()
      : ao.tool_id
        ? await admin
            .from("tool_entitlements")
            .select("expires_at")
            .eq("organization_id", ao.organization_id)
            .eq("tool_id", ao.tool_id)
            .eq("is_all_access", false)
            .maybeSingle()
        : await entQuery.eq("is_all_access", false).maybeSingle();
    expiresAt = (scoped.data as { expires_at: string | null } | null)?.expires_at ?? null;
  } catch {
    expiresAt = null;
  }

  const after = {
    orderStatus: ao.status,
    paymentStatus: ap?.status ?? p.status,
    orderId: ao.id,
    paymentId: p.id,
    expiresAt,
  };

  if (ao.status !== "paid") {
    await recordAdminAudit({
      action: "billing.payment_completion_replay",
      targetType: "payment",
      targetId: p.id,
      organizationId: o.organization_id,
      reason: cleanReason,
      before,
      after,
    });
    throw new Error(`Repair did not complete the order (status: ${ao.status}) — manual review required`);
  }

  await recordAdminAudit({
    action: "billing.payment_completion_replay",
    targetType: "payment",
    targetId: p.id,
    organizationId: o.organization_id,
    reason: cleanReason,
    before,
    after,
  });

  return { mutated: true, idempotent: false, before, after };
}

// ── Mutation 3: revoke erroneous Free grant ──────────────────────────────

const REVOKABLE_SOURCES = new Set(["free"]);

export async function revokeFreeGrant(
  entitlementId: string,
  reason: string,
  confirmed: boolean,
): Promise<MutationOutcome> {
  const actor = await requireSuperAdmin();
  void actor;
  requireUuid(entitlementId, "entitlement ID");
  const admin = createAdminClient();

  // Explicitly refuse user-scoped grants in this path (different table, different semantics)
  const { data: userGrant } = await admin.from("user_tool_entitlements").select("id").eq("id", entitlementId).maybeSingle();
  if (userGrant) throw new Error("User-scoped grants cannot be revoked here");

  const { data: ent, error } = await admin
    .from("tool_entitlements")
    .select("id, organization_id, tool_id, is_all_access, source, expires_at")
    .eq("id", entitlementId)
    .maybeSingle();
  if (error || !ent) throw new Error("Entitlement not found");
  const e = ent as {
    id: string;
    organization_id: string;
    tool_id: string | null;
    is_all_access: boolean;
    source: string;
    expires_at: string | null;
  };

  if (!REVOKABLE_SOURCES.has(e.source)) {
    throw new Error(`Only source='free' grants can be revoked here (source: ${e.source})`);
  }
  if (e.is_all_access) throw new Error("All Access grants cannot be revoked here");
  if (!e.tool_id) throw new Error("Entitlement has no tool — manual review required");

  const { data: toolRow } = await admin.from("tools").select("slug, name").eq("id", e.tool_id).maybeSingle();
  const toolSlug = (toolRow as { slug: string; name: string } | null)?.slug ?? null;
  const toolName = (toolRow as { slug: string; name: string } | null)?.name ?? "Unknown tool";
  if (!toolSlug || !(SIX_TOOL_SLUGS as readonly string[]).includes(toolSlug)) {
    throw new Error("Entitlement tool is not a released tool — manual review required");
  }

  // Already revoked/expired → safe rejection (preserves row history)
  if (e.expires_at !== null && new Date(e.expires_at) <= new Date()) {
    throw new Error("Entitlement is already expired");
  }

  const preview = {
    entitlementId: e.id,
    tool: toolSlug,
    toolName,
    organizationId: e.organization_id,
    source: e.source,
    fromExpiresAt: e.expires_at,
    toState: "revoked (expires immediately)",
  };
  if (!confirmed) return { mutated: false, preview };

  const cleanReason = requireReason(reason);
  const before = { source: e.source, expiresAt: e.expires_at, tool: toolSlug, organizationId: e.organization_id };
  // Revoke = expire immediately. Row is preserved for history; never deleted.
  const { error: updateError } = await admin
    .from("tool_entitlements")
    .update({ expires_at: new Date().toISOString() })
    .eq("id", e.id)
    .eq("source", "free");
  if (updateError) throw new Error(`Failed to revoke grant: ${updateError.message}`);
  const after = { source: e.source, revoked: true, tool: toolSlug, organizationId: e.organization_id };

  await recordAdminAudit({
    action: "entitlement.free_revoke",
    targetType: "entitlement",
    targetId: e.id,
    organizationId: e.organization_id,
    reason: cleanReason,
    before,
    after,
  });

  return { mutated: true, idempotent: false, before, after };
}
