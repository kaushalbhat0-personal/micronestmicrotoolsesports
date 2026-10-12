"use server";

import { claimFreeTool } from "@/server/services/tool-claim";
import { PAYOUT_TRACKER_TOOL_SLUG } from "../tool-slug";

/**
 * Claim Free Prize Payout Tracker for the workspace (no payment, no order).
 * Thin alias over the generic claim dispatch — membership first,
 * org-scoped issuance only, never downgrades paid.
 */
export async function claimFreePayoutTrackerAction(orgSlug: string): Promise<{ ok?: boolean; error?: string }> {
  return claimFreeTool(PAYOUT_TRACKER_TOOL_SLUG, orgSlug);
}
