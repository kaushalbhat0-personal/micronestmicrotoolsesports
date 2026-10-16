import { getAvailableTools, getMarketingTool } from "@/config/marketing/tools";
import { freeBadgeBySlug, freeTierBySlug } from "@/config/marketing/free-tiers";

/**
 * Homepage (toolbox-level) SEO — single source for identity metadata.
 *
 * Toolbox-first: MicroNest is the product; the seven tools are products
 * inside the toolbox. No single tool dominates homepage identity.
 *
 * Workspace tools derive from the canonical marketing registry
 * (`getAvailableTools()` — never a hardcoded subset). Meta-Parser is public
 * patch intelligence, not a workspace subscription product, so it lives
 * outside that registry; only its canonical public route and display name
 * are referenced here (facts catalog itself is DB-driven via
 * `features/meta-parser/repositories/reads.ts`). This file defines no tool
 * catalog — it composes existing sources for SEO presentation only.
 */

export const HOMEPAGE_TITLE = "MicroNest — The Toolbox Behind Esports";

export const HOMEPAGE_DESCRIPTION =
  "MicroNest is the toolbox behind esports — small, focused tools for tournament operations, sponsorships, payouts, rosters, and public patch intelligence. Every workspace tool starts free.";

export type HomepageToolboxKind = "workspace-tool" | "patch-intelligence";

export interface HomepageToolboxItem {
  /** Stable 1-based position for ItemList. */
  readonly position: number;
  readonly name: string;
  /** Canonical relative route (matches existing JSON-LD convention). */
  readonly url: string;
  readonly kind: HomepageToolboxKind;
}

/**
 * Public patch-facts entry. Name and route only — coverage (games, patch
 * versions, change counts) stays catalog-driven on `/meta-parser` and must
 * never be hardcoded here.
 */
export const META_PARSER_ITEM = {
  name: "Meta-Parser — Patch Notes Intelligence",
  url: "/meta-parser",
  kind: "patch-intelligence",
  /** Card value proposition — presentation copy, no capability claims. */
  description: "Read structured patch notes and game changes.",
  /** Lucide icon key (see homepage icon map). */
  icon: "Newspaper",
} as const;

/** Seven released toolbox entries: registry workspace tools + Meta-Parser. */
export function getHomepageToolboxItems(): HomepageToolboxItem[] {
  const workspace = getAvailableTools().map((tool, index) => ({
    position: index + 1,
    name: tool.name,
    url: `/tools/${tool.slug}`,
    kind: "workspace-tool",
  }) as const);
  return [
    ...workspace,
    { position: workspace.length + 1, ...META_PARSER_ITEM },
  ];
}

/**
 * Neutral toolbox grouping — organizational only, never a ranking.
 * Slugs only; every display field resolves from the canonical registry
 * (workspace tools) or the Meta-Parser pointer above. No duplicated catalog.
 */
export interface ToolboxGroupDef {
  readonly label: string;
  readonly blurb: string;
  /** Registry slugs plus the `"meta-parser"` public-intelligence key. */
  readonly slugs: readonly string[];
}

export const TOOLBOX_GROUPS: readonly ToolboxGroupDef[] = [
  {
    label: "Run the tournament",
    blurb: "Prizes, drafts, standings, and slots — settled on the day.",
    slugs: ["prize-pool-splitter", "draft-ban", "tie-breaker", "tournament-roster-builder"],
  },
  {
    label: "Run the business",
    blurb: "Sponsors and payouts — organized proof, not spreadsheets.",
    slugs: ["sponsorship-tracking", "prize-payout-tracker"],
  },
  {
    label: "Understand the game",
    blurb: "Public patch intelligence — facts first, interpretation later.",
    slugs: ["meta-parser"],
  },
] as const;

export interface ToolboxGroupCard {
  readonly name: string;
  readonly url: string;
  readonly description: string;
  readonly kind: HomepageToolboxKind;
  /** Lucide icon key matching the registry `icon` field. */
  readonly icon: string;
  readonly ctaLabel: string;
  readonly ctaAriaLabel: string;
  /** Truthful access framing, e.g. "Free plan · 1 campaign …" or "Public facts · Free to read". */
  readonly accessNote: string;
}

export interface ResolvedToolboxGroup {
  readonly label: string;
  readonly blurb: string;
  readonly cards: ToolboxGroupCard[];
}

/** Resolve group slugs to render-ready cards. Throws on unknown slug (fail closed). */
export function resolveToolboxGroups(): ResolvedToolboxGroup[] {
  return TOOLBOX_GROUPS.map((group) => ({
    label: group.label,
    blurb: group.blurb,
    cards: group.slugs.map((slug): ToolboxGroupCard => {
      if (slug === "meta-parser") {
        return {
          name: META_PARSER_ITEM.name,
          url: META_PARSER_ITEM.url,
          description: META_PARSER_ITEM.description,
          kind: META_PARSER_ITEM.kind,
          icon: META_PARSER_ITEM.icon,
          ctaLabel: "Browse patch facts",
          ctaAriaLabel: "Browse Meta-Parser patch facts",
          accessNote: "Public facts · Free to read",
        };
      }
      const tool = getMarketingTool(slug);
      if (!tool || !tool.internalSlug) throw new Error(`Unknown toolbox group slug: ${slug}`);
      const badge = freeBadgeBySlug(tool.internalSlug) ?? "Free plan";
      const allowance = freeTierBySlug(tool.internalSlug)?.allowance ?? "";
      return {
        name: tool.name,
        url: `/tools/${tool.slug}`,
        description: tool.shortDescription,
        kind: "workspace-tool",
        icon: tool.icon,
        ctaLabel: tool.hasPublicDemo ? "Try it now" : "Learn more",
        ctaAriaLabel: tool.hasPublicDemo
          ? `Try ${tool.name} now — no signup needed`
          : `Learn more about ${tool.name}`,
        accessNote: allowance ? `${badge} · ${allowance}` : badge,
      };
    }),
  }));
}

function workspaceToolNode(item: HomepageToolboxItem): Record<string, unknown> {
  // Minimal truthful SoftwareApplication shape — same fields the per-tool
  // pages already emit. No ratings, reviews, prices, or download claims.
  return {
    "@type": "SoftwareApplication",
    name: item.name,
    url: item.url,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
  };
}

function patchIntelligenceNode(item: HomepageToolboxItem): Record<string, unknown> {
  // Meta-Parser is public facts pages, not installed software — WebPage, not
  // SoftwareApplication. No capability claims beyond "patch facts".
  return {
    "@type": "WebPage",
    name: item.name,
    url: item.url,
    description: "Public patch facts and patch intelligence for supported competitive games.",
  };
}

/** ItemList of the seven released tools — positions, names, canonical URLs. */
export function buildHomepageItemListJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "MicroNest toolbox",
    description: "The seven released MicroNest esports tools.",
    numberOfItems: 7,
    itemListElement: getHomepageToolboxItems().map((item) => ({
      "@type": "ListItem",
      position: item.position,
      name: item.name,
      url: item.url,
      item:
        item.kind === "workspace-tool" ? workspaceToolNode(item) : patchIntelligenceNode(item),
    })),
  };
}

/** Organization represents MicroNest itself — no company-registration claims. */
export function buildHomepageOrganizationJsonLd(siteUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "MicroNest",
    alternateName: "MicroNest MicroTools",
    slogan: "The toolbox behind esports.",
    url: siteUrl,
    description:
      "MicroNest is the toolbox behind esports — small, focused tools for tournament operations, sponsorships, payouts, rosters, and public patch intelligence.",
    sameAs: [],
  };
}

/** WebSite represents the MicroNest website/toolbox — no SearchAction (no site search). */
export function buildHomepageWebsiteJsonLd(siteUrl: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "MicroNest",
    alternateName: "MicroNest MicroTools",
    url: siteUrl,
    description:
      "The toolbox behind esports — focused tools for tournament operations, sponsorships, payouts, rosters, and public patch intelligence.",
  };
}
