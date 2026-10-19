import { getAvailableTools, getMarketingTool } from "@/config/marketing/tools";
import { freeBadgeBySlug, freeTierBySlug } from "@/config/marketing/free-tiers";

/**
 * Homepage (toolbox-level) SEO — single source for identity metadata.
 *
 * Toolbox-first: MicroNest is the product; the released tools are products
 * inside the toolbox. No single tool dominates homepage identity.
 *
 * Workspace tools derive from the canonical marketing registry
 * (`getAvailableTools()` — never a hardcoded subset). Meta-Parser is public
 * patch intelligence, the BGMI Qualification Simulator is a public
 * instant-use microtool, and the BGMI Tournament Hub is a public
 * informational product — none is a workspace subscription product, so
 * all three live outside that registry; only their canonical public routes
 * and display names are referenced here (facts/standings catalogs are
 * DB-driven). This file defines no tool catalog — it composes existing
 * sources for SEO presentation only.
 */

export const HOMEPAGE_TITLE = "MicroNest — The Toolbox Behind Esports";

export const HOMEPAGE_DESCRIPTION =
  "MicroNest is the toolbox behind esports — small, focused tools for tournament operations, sponsorships, payouts, rosters, and public patch intelligence. Every workspace tool starts free.";

export type HomepageToolboxKind = "workspace-tool" | "patch-intelligence" | "public-microtool" | "tournament-hub";

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

/**
 * Public instant-use microtool entry. Name and route only — the calculator
 * itself is fully client-side with no account, no storage, and no plans,
 * so it carries no workspace/entitlement/billing semantics by design.
 */
export const BGMI_QUALIFICATION_ITEM = {
  name: "BGMI Qualification Simulator",
  url: "/bgmi-qualification",
  kind: "public-microtool",
  /** Card value proposition — approved positioning, no outcome promises. */
  description: "Know what your team needs to qualify.",
  /** Lucide icon key (see homepage icon map). */
  icon: "Target",
} as const;

/**
 * Public tournament-information entry. Name and route only — standings,
 * results, and history stay catalog-driven (DB via
 * `features/bgmi-tournaments/repositories/reads.ts`) and must never be
 * hardcoded here.
 */
export const BGMI_TOURNAMENTS_ITEM = {
  name: "BGMI Tournament Hub",
  url: "/bgmi-tournaments",
  kind: "tournament-hub",
  /** Card value proposition — positioning copy, no capability claims. */
  description: "See standings, match results, and history.",
  /** Lucide icon key (see homepage icon map). */
  icon: "Trophy",
} as const;

/** Toolbox entries: registry workspace tools + Meta-Parser + BGMI simulator + Tournament Hub. */
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
    { position: workspace.length + 2, ...BGMI_QUALIFICATION_ITEM },
    { position: workspace.length + 3, ...BGMI_TOURNAMENTS_ITEM },
  ];
}

/**
 * Neutral toolbox grouping — organizational only, never a ranking.
 * Slugs only; every display field resolves from the canonical registry
 * (workspace tools) or the public-tool pointers above. No duplicated catalog.
 */
export interface ToolboxGroupDef {
  readonly label: string;
  readonly blurb: string;
  /** Registry slugs plus the `"meta-parser"` / `"bgmi-qualification"` / `"bgmi-tournaments"` public-tool keys. */
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
  {
    label: "Qualify on points",
    blurb: "Standings, targets and what-if scenarios — where teams stand and what they need to qualify.",
    slugs: ["bgmi-qualification", "bgmi-tournaments"],
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
      if (slug === "bgmi-qualification") {
        return {
          name: BGMI_QUALIFICATION_ITEM.name,
          url: BGMI_QUALIFICATION_ITEM.url,
          description: BGMI_QUALIFICATION_ITEM.description,
          kind: BGMI_QUALIFICATION_ITEM.kind,
          icon: BGMI_QUALIFICATION_ITEM.icon,
          ctaLabel: "Try it now",
          ctaAriaLabel: "Try the BGMI Qualification Simulator now — no signup needed",
          accessNote: "Free microtool · No signup",
        };
      }
      if (slug === "bgmi-tournaments") {
        return {
          name: BGMI_TOURNAMENTS_ITEM.name,
          url: BGMI_TOURNAMENTS_ITEM.url,
          description: BGMI_TOURNAMENTS_ITEM.description,
          kind: BGMI_TOURNAMENTS_ITEM.kind,
          icon: BGMI_TOURNAMENTS_ITEM.icon,
          ctaLabel: "Browse standings",
          ctaAriaLabel: "Browse BGMI tournament standings and results — free to read",
          accessNote: "Public standings · Free to read",
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

/** ItemList of the released toolbox — positions, names, canonical URLs (count derived). */
export function buildHomepageItemListJsonLd(): Record<string, unknown> {
  const items = getHomepageToolboxItems();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "MicroNest toolbox",
    description: `The ${items.length} released MicroNest esports tools.`,
    numberOfItems: items.length,
    itemListElement: items.map((item) => ({
      "@type": "ListItem",
      position: item.position,
      name: item.name,
      url: item.url,
      item:
        item.kind === "workspace-tool" || item.kind === "public-microtool"
          ? workspaceToolNode(item)
          : item.kind === "tournament-hub"
            ? tournamentHubNode(item)
            : patchIntelligenceNode(item),
    })),
  };
}

function tournamentHubNode(item: HomepageToolboxItem): Record<string, unknown> {
  // The Tournament Hub is public informational pages — WebPage, not
  // installed software. No capability claims beyond standings/results.
  return {
    "@type": "WebPage",
    name: item.name,
    url: item.url,
    description: "Public BGMI tournament standings and match results — updated after completed matches.",
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
