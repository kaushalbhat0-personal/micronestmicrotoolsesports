import { getMarketingTool, type MarketingTool } from "@/config/marketing/tools";
import { TOOL_PLAN_PREFIX } from "@/lib/marketing/tool-offers";
import { coveredToolSlugs, formatPlanPrice } from "@/lib/purchase/plan-guidance";
import type { Plan } from "@/types/database";

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
  // Note: `coveredInternal` includes roster-builder (workspace bundle
  // narrative), but the display list below is the paid-only set — Roster
  // Builder has no paid plan and must never render as a paid card.
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

export interface PlanTeaser {
  readonly monthly: string | null;
  readonly yearly: string | null;
}

/**
 * Derive per-prefix monthly/yearly teaser strings from a single
 * server-side plan-list read. Pure presentation: never fetches, never
 * fabricates — prefixes without an active INR plan stay null so cards
 * render without prices. Roster Builder has no prefix and therefore can
 * never receive a teaser.
 */
export function buildPlanTeasers(
  plans: readonly Plan[],
  prefixes: readonly string[]
): Map<string, PlanTeaser> {
  const teasers = new Map<string, PlanTeaser>();
  for (const prefix of prefixes) teasers.set(prefix, { monthly: null, yearly: null });
  for (const plan of plans) {
    if (plan.currency !== "INR" || !plan.is_active) continue;
    for (const prefix of prefixes) {
      if (plan.slug === `${prefix}-monthly`) {
        teasers.set(prefix, { ...teasers.get(prefix)!, monthly: formatPlanPrice(plan.amount_minor, plan.currency) });
      } else if (plan.slug === `${prefix}-yearly`) {
        teasers.set(prefix, { ...teasers.get(prefix)!, yearly: formatPlanPrice(plan.amount_minor, plan.currency) });
      }
    }
  }
  return teasers;
}
