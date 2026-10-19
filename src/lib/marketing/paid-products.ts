import { getMarketingTool, type MarketingTool } from "@/config/marketing/tools";
import { TOOL_PLAN_PREFIX } from "@/lib/marketing/tool-offers";
import { coveredToolSlugs } from "@/lib/purchase/plan-guidance";

/**
 * Shared paid-product presentation source (Phase 0.2).
 *
 * Presentation-only: derives the five paid tools from TOOL_PLAN_PREFIX
 * (never a second hardcoded slug list) and represents All Access via the
 * existing coverage definition in plan-guidance.ts. No prices here —
 * prices always come from server-side plan data. No billing logic moved.
 */

export interface PaidProductEntry {
  readonly marketingSlug: string;
  readonly tool: MarketingTool;
  readonly planPrefix: string;
}

export function getPaidProductEntries(): PaidProductEntry[] {
  const entries: PaidProductEntry[] = [];
  for (const marketingSlug of Object.keys(TOOL_PLAN_PREFIX)) {
    const tool = getMarketingTool(marketingSlug);
    if (!tool) continue;
    entries.push({ marketingSlug, tool, planPrefix: TOOL_PLAN_PREFIX[marketingSlug] as string });
  }
  return entries;
}

export interface AllAccessEntry {
  readonly name: string;
  readonly coveredMarketingSlugs: readonly string[];
  readonly coveredInternalSlugs: readonly string[];
}

const PLAN_PREFIX_TO_MARKETING_SLUG: Record<string, string> = {
  "sponsorship-tracking": "sponsorship-tracking",
  "prize-pool-splitter": "prize-pool-splitter",
  "draft-ban": "draft-ban",
  "tie-breaker": "tie-breaker",
  "prize-payout-tracker": "prize-payout-tracker",
};

/** All Access bundle presentation — coverage reuses coveredToolSlugs (no new list). */
export function getAllAccessEntry(): AllAccessEntry {
  const coveredInternal = coveredToolSlugs("all-access-monthly");
  // Roster Builder is unlimited/free and has no paid plan; it is part of the
  // workspace bundle narrative but must never render as a paid card.
  const paidOnly = coveredInternal.filter((s) => s !== "roster-builder");
  void paidOnly;
  const coveredMarketingSlugs = Object.entries(PLAN_PREFIX_TO_MARKETING_SLUG).map(([, slug]) => slug);
  return {
    name: "All Access",
    coveredMarketingSlugs,
    coveredInternalSlugs: coveredInternal,
  };
}

/** Marketing slugs that carry a paid plan. Roster Builder is never included. */
export function isPaidMarketingSlug(marketingSlug: string): boolean {
  return marketingSlug in TOOL_PLAN_PREFIX;
}
