"use server";

import { expireStuckOrder, replayPaymentCompletion, revokeFreeGrant } from "@/server/admin/billing-repairs";
import { grantPlatformAdmin, revokePlatformAdmin } from "@/server/admin/platform-admins";

/**
 * Superadmin mutation actions — thin server-action wrappers.
 * Authorization, bounded operation, and audit live in the underlying
 * services. Client passes IDs + reason + explicit confirmation only.
 */

export async function expireStuckOrderAction(orderId: string, reason: string, confirmed: boolean) {
  try {
    const outcome = await expireStuckOrder(orderId, reason, confirmed);
    if (!outcome.mutated) return { ok: true as const, preview: outcome.preview };
    return { ok: true as const, idempotent: outcome.idempotent, before: outcome.before, after: outcome.after };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Failed to expire order" };
  }
}

export async function replayPaymentCompletionAction(paymentId: string, reason: string, confirmed: boolean) {
  try {
    const outcome = await replayPaymentCompletion(paymentId, reason, confirmed);
    if (!outcome.mutated) return { ok: true as const, preview: outcome.preview };
    return { ok: true as const, idempotent: outcome.idempotent, before: outcome.before, after: outcome.after };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Failed to replay payment completion" };
  }
}

export async function revokeFreeGrantAction(entitlementId: string, reason: string, confirmed: boolean) {
  try {
    const outcome = await revokeFreeGrant(entitlementId, reason, confirmed);
    if (!outcome.mutated) return { ok: true as const, preview: outcome.preview };
    return { ok: true as const, idempotent: outcome.idempotent, before: outcome.before, after: outcome.after };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Failed to revoke grant" };
  }
}

export async function grantPlatformAdminAction(userId: string, reason: string) {
  return grantPlatformAdmin(userId, reason);
}

export async function revokePlatformAdminAction(userId: string, reason: string) {
  return revokePlatformAdmin(userId, reason);
}
