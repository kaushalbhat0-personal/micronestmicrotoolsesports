import { TOOLS, type ToolConfig } from "@/config/app/tools";
import type { Route } from "next";

/**
 * Entitlement-aware tool view model — registry-driven.
 * Source of truth: has_tool_access / tool_entitlements via getAccessibleToolSlugs.
 * Navigation consumes this, never hardcodes sponsor-sentinel.
 */

export interface WorkspaceTool {
  slug: string;
  name: string; // customer-facing
  internalSlug: string;
  description: string;
  icon: string;
  href: Route;
  entitled: boolean;
  comingSoon: boolean;
  subItems?: { label: string; href: Route; icon: string }[];
}

const CUSTOMER_NAMES: Record<string, string> = {
  "sponsor-sentinel": "Sponsorship Tracking",
  "prize-splitter": "Prize Pool Splitter",
  "draft-ban": "Draft & Ban",
  "tie-breaker": "Tie-Breaker Resolver",
};

function customerName(cfg: ToolConfig): string {
  return CUSTOMER_NAMES[cfg.slug] ?? cfg.name;
}

function toolHref(slug: string, orgSlug: string): Route {
  // Sponsorship Tracking primary entry is campaigns; others are tool root (coming soon)
  if (slug === "sponsor-sentinel") return `/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route;
  return `/dashboard/${orgSlug}/${slug}` as Route;
}

export function toWorkspaceTools(allToolConfigs: readonly ToolConfig[], entitledSlugs: readonly string[], orgSlug: string): {
  entitled: WorkspaceTool[];
  available: WorkspaceTool[];
} {
  const entitledSet = new Set(entitledSlugs);
  const entitled: WorkspaceTool[] = [];
  const available: WorkspaceTool[] = [];

  for (const cfg of allToolConfigs) {
    // Defense in depth: coming-soon tools never belong in operational
    // navigation, even if a caller passes a dirty slug list. Commercial
    // availability is enforced upstream (getAccessibleToolSlugs); this keeps
    // the transform's contract ("entitled = usable now") total.
    const isEntitled = entitledSet.has(cfg.slug) && !cfg.comingSoon;
    const tool: WorkspaceTool = {
      slug: cfg.slug,
      name: customerName(cfg),
      internalSlug: cfg.slug,
      description: cfg.description,
      icon: cfg.icon,
      href: toolHref(cfg.slug, orgSlug),
      entitled: isEntitled,
      comingSoon: Boolean(cfg.comingSoon),
    ...(cfg.slug === "sponsor-sentinel"
      ? {
          // Sponsorship sub-navigation — visual nesting only. Routes are
          // top-level and unchanged; Channels/Connections primarily support
          // Sponsorship Tracking, so they live beneath it in the sidebar.
          subItems: [
            { label: "Campaigns", href: `/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route, icon: "ShieldCheck" },
            { label: "Checks", href: `/dashboard/${orgSlug}/sponsor-sentinel/scans` as Route, icon: "History" },
            { label: "Channels", href: `/dashboard/${orgSlug}/channels` as Route, icon: "Tv" },
            { label: "Connections", href: `/dashboard/${orgSlug}/connections` as Route, icon: "Plug" },
          ],
        }
      : {}),
    };
    if (isEntitled) entitled.push(tool);
    else available.push(tool);
  }

  return { entitled, available };
}

export async function getWorkspaceToolsForOrg(organizationId: string, orgSlug: string): Promise<{ entitled: WorkspaceTool[]; available: WorkspaceTool[] }> {
  // Use server helper that already encapsulates has_tool_access / all-access
  const { getAccessibleToolSlugs } = await import("@/lib/auth/require-entitlement");
  const slugs = await getAccessibleToolSlugs(organizationId).catch(() => []);
  return toWorkspaceTools(TOOLS, slugs, orgSlug);
}
