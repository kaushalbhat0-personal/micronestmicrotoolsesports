import { getAvailableTools, type MarketingTool } from "@/config/marketing/tools";
import { META_PARSER_ITEM } from "./homepage-seo";

/**
 * Public toolbox presentation composer (RCCF-TOOLBOX-IA-02).
 *
 * Presentation-only: composes the six workspace marketing tools with the
 * public Meta-Parser intelligence entry so surfaces like `/tools` and the
 * sitemap can present all seven toolbox entries exactly once.
 *
 * Workspace isolation is preserved by construction:
 * - `TOOLS`, `MARKETING_TOOLS`, `POLICIES`, `FREE_TIERS`,
 *   `TOOL_PLAN_PREFIX`, entitlement, billing, plans, and checkout are
 *   never touched here — this module only reads the marketing registry
 *   plus the existing homepage Meta-Parser pointer.
 * - The Meta-Parser entry carries no plan/price/entitlement semantics.
 */

export type ToolboxEntryKind = "workspace" | "patch-intelligence";

export interface ToolboxEntry {
  /** Public slug (`meta-parser` or the marketing slug). */
  readonly slug: string;
  readonly name: string;
  /** Canonical relative route. */
  readonly url: string;
  readonly kind: ToolboxEntryKind;
  readonly description: string;
  /** Lucide icon key matching the registry `icon` field. */
  readonly icon: string;
  readonly ctaLabel: string;
  readonly ctaAriaLabel: string;
  /** Truthful access framing, e.g. "Free plan · …" or "Public facts · Free to read". */
  readonly accessNote: string;
  /** Workspace registry entry — present only for workspace tools. Never set for Meta-Parser. */
  readonly marketingTool?: MarketingTool;
}

/**
 * Public Meta-Parser card content. Route/icon/kind reuse the canonical
 * homepage pointer; display copy follows the toolbox spec (plain
 * "Meta-Parser" name, public patch-intelligence positioning, facts-only
 * CTA). No plan, price, claim, or workspace semantics by design.
 */
export const META_PARSER_ENTRY: ToolboxEntry = {
  slug: "meta-parser",
  name: "Meta-Parser",
  url: META_PARSER_ITEM.url,
  kind: "patch-intelligence",
  description: "Read current patch facts across supported competitive games.",
  icon: META_PARSER_ITEM.icon,
  ctaLabel: "Browse patch facts",
  ctaAriaLabel: "Browse Meta-Parser public patch facts",
  accessNote: "Public facts · Free to read",
};

/** Six released workspace tools as presentation entries (order = registry order). */
export function getWorkspaceEntries(): ToolboxEntry[] {
  return getAvailableTools().map((tool) => ({
    slug: tool.slug,
    name: tool.name,
    url: `/tools/${tool.slug}`,
    kind: "workspace" as const,
    description: tool.shortDescription,
    icon: tool.icon,
    ctaLabel: "View tool",
    ctaAriaLabel: `View ${tool.name}`,
    accessNote: "Workspace tool · Starts free",
    marketingTool: tool,
  }));
}

/** Seven public toolbox entries: six workspace tools plus Meta-Parser. */
export function getToolboxEntries(): ToolboxEntry[] {
  return [...getWorkspaceEntries(), META_PARSER_ENTRY];
}
