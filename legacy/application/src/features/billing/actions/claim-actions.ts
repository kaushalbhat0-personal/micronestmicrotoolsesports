"use server";

import { claimFreeTool } from "@/server/services/tool-claim";
import { SPONSORSHIP_TOOL_SLUG } from "@/server/services/sponsorship-policy";
import { TIE_BREAKER_TOOL_SLUG } from "@/server/services/tie-breaker-policy";
import { DRAFT_BAN_TOOL_SLUG } from "@/server/services/draft-ban-policy";
import { PRIZE_SPLITTER_TOOL_SLUG } from "@/server/services/prize-splitter-policy";
import { PAYOUT_TRACKER_TOOL_SLUG } from "@/server/services/payout-tracker-policy";
import { ROSTER_BUILDER_TOOL_SLUG } from "@/server/services/roster-builder-policy";

/**
 * Billing Free-claim actions — thin per-tool aliases over the generic
 * `claimFreeTool` dispatch.
 *
 * Each action receives ONLY the workspace slug from the client. The tool
 * slug is bound server-side to a canonical policy constant, so client
 * input can never become authorization authority: membership, commercial
 * availability, policy gates, idempotency, and no-downgrade are all
 * re-verified inside `claimFreeTool`. No feature-to-feature imports —
 * only `server/services` are consumed here.
 */

export async function claimFreeSponsorshipBillingAction(orgSlug: string): Promise<{ ok?: boolean; error?: string }> {
  return claimFreeTool(SPONSORSHIP_TOOL_SLUG, orgSlug);
}

export async function claimFreePrizeSplitterBillingAction(orgSlug: string): Promise<{ ok?: boolean; error?: string }> {
  return claimFreeTool(PRIZE_SPLITTER_TOOL_SLUG, orgSlug);
}

export async function claimFreeDraftBanBillingAction(orgSlug: string): Promise<{ ok?: boolean; error?: string }> {
  return claimFreeTool(DRAFT_BAN_TOOL_SLUG, orgSlug);
}

export async function claimFreeTieBreakerBillingAction(orgSlug: string): Promise<{ ok?: boolean; error?: string }> {
  return claimFreeTool(TIE_BREAKER_TOOL_SLUG, orgSlug);
}

export async function claimFreePayoutTrackerBillingAction(orgSlug: string): Promise<{ ok?: boolean; error?: string }> {
  return claimFreeTool(PAYOUT_TRACKER_TOOL_SLUG, orgSlug);
}

export async function claimFreeRosterBuilderBillingAction(orgSlug: string): Promise<{ ok?: boolean; error?: string }> {
  return claimFreeTool(ROSTER_BUILDER_TOOL_SLUG, orgSlug);
}
