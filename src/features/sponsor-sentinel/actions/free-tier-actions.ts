"use server";

import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureFreeSponsorshipGrant } from "@/server/services/user-sponsorship-service";
import { AppError } from "@/lib/errors";

/**
 * Claim Free Sponsorship Tracking (no payment, no order, no Razorpay).
 * Service-role issuance only; never overwrites an existing (paid) grant.
 * Membership is verified first via organization context.
 */
export async function claimFreeSponsorshipAction(orgSlug: string): Promise<{ ok?: boolean; error?: string }> {
  if (!orgSlug) return { error: "Missing organization" };
  try {
    const ctx = await requireOrganizationContext(orgSlug);
    const admin = createAdminClient();
    await ensureFreeSponsorshipGrant(admin as never, ctx.user.id);
    return { ok: true };
  } catch (e) {
    if (e instanceof AppError) {
      console.warn(`[AppError ${e.code}]`, e.safeMessage);
      return { error: e.safeMessage };
    }
    console.error("[claimFreeSponsorshipAction] unexpected", e);
    return { error: "Something went wrong. Please try again." };
  }
}
