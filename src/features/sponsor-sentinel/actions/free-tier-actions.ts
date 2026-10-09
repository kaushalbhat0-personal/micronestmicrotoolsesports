"use server";

import { claimFreeTool } from "@/server/services/tool-claim";
import { SPONSORSHIP_TOOL_SLUG } from "@/server/services/user-sponsorship-service";

/**
 * Claim Free Sponsorship Tracking (no payment, no order, no Razorpay).
 * Thin compatibility alias over the generic claim dispatch — behavior
 * preserved exactly (membership first, service-role issuance only, never
 * overwrites an existing paid grant).
 */
export async function claimFreeSponsorshipAction(orgSlug: string): Promise<{ ok?: boolean; error?: string }> {
  return claimFreeTool(SPONSORSHIP_TOOL_SLUG, orgSlug);
}
