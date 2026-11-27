"use server";

import { claimFreeTool } from "@/server/services/tool-claim";
import { PRIZE_SPLITTER_TOOL_SLUG } from "@/server/services/prize-splitter-policy";

/**
 * Claim Free Prize Pool Splitter for the workspace (no payment, no order).
 * Thin alias over the generic claim dispatch — membership first,
 * org-scoped issuance only, never downgrades paid.
 */
export async function claimFreePrizeSplitterAction(orgSlug: string): Promise<{ ok?: boolean; error?: string }> {
  return claimFreeTool(PRIZE_SPLITTER_TOOL_SLUG, orgSlug);
}
