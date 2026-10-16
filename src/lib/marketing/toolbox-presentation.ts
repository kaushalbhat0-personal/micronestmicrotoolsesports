import { getAvailableTools, type MarketingTool } from "@/config/marketing/tools";
import { BGMI_QUALIFICATION_ITEM, META_PARSER_ITEM } from "./homepage-seo";

/**
 * Public toolbox presentation composer (RCCF-TOOLBOX-IA-02).
 *
 * Presentation-only: composes the six workspace marketing tools with the
 * public Meta-Parser intelligence entry and the public BGMI Qualification
 * Simulator entry so surfaces like `/tools` and the
 * sitemap can present all eight toolbox entries exactly once.
 *
 * Workspace isolation is preserved by construction:
 * - `TOOLS`, `MARKETING_TOOLS`, `POLICIES`, `FREE_TIERS`,
 *   `TOOL_PLAN_PREFIX`, entitlement, billing, plans, and checkout are
 *   never touched here — this module only reads the marketing registry
 *   plus the existing public-tool pointers.
 * - The Meta-Parser and BGMI entries carry no plan/price/entitlement semantics.
 */

export type ToolboxEntryKind = "workspace" | "patch-intelligence" | "public-microtool";

export interface ToolboxEntry {
  /** Public slug (`meta-parser`, `bgmi-qualification`, or the marketing slug). */
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
  /** Workspace registry entry — present only for workspace tools. Never set for public entries. */
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

/**
 * Public BGMI Qualification Simulator card content. Route/icon/kind reuse
 * the canonical homepage pointer; display copy follows the approved
 * positioning ("Know what your team needs to qualify"). Fully client-side,
 * no account — "Try it now" matches the anonymous-demo CTA convention.
 * No plan, price, claim, or workspace semantics by design.
 */
export const BGMI_QUALIFICATION_ENTRY: ToolboxEntry = {
  slug: "bgmi-qualification",
  name: "BGMI Qualification Simulator",
  url: BGMI_QUALIFICATION_ITEM.url,
  kind: "public-microtool",
  description: "Know what your team needs to qualify.",
  icon: BGMI_QUALIFICATION_ITEM.icon,
  ctaLabel: "Try it now",
  ctaAriaLabel: "Try the BGMI Qualification Simulator now — no signup needed",
  accessNote: "Free microtool · No signup",
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

/** Eight public toolbox entries: six workspace tools plus Meta-Parser and the BGMI simulator. */
export function getToolboxEntries(): ToolboxEntry[] {
  return [...getWorkspaceEntries(), META_PARSER_ENTRY, BGMI_QUALIFICATION_ENTRY];
}
