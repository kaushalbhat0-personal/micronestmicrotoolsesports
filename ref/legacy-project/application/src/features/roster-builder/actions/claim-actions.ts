"use server";

import { claimFreeTool } from "@/server/services/tool-claim";
import { ROSTER_BUILDER_TOOL_SLUG } from "@/server/services/roster-builder-policy";

/**
 * Claim Free Tournament Roster & Slot Builder for the workspace
 * (no payment, no order). Thin alias over the generic claim dispatch —
 * membership first, org-scoped issuance only, never downgrades paid.
 */
export async function claimFreeRosterBuilderAction(orgSlug: string): Promise<{ ok?: boolean; error?: string }> {
  return claimFreeTool(ROSTER_BUILDER_TOOL_SLUG, orgSlug);
}
