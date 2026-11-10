import { TOOLS } from "@/config/app/tools";
import type { BillingAvailableCard, BillingToolCard } from "@/server/services/billing-service";
import type { CatalogTool } from "@/components/workspace/tool-catalog-card";

/**
 * Workspace catalog view-model (RCCF F3/F4). Merges Billing's authoritative
 * discovery sections into registry-ordered catalog cards. Type-only
 * coupling to billing-service and the catalog component — no runtime
 * imports, no duplicated registries, never a hardcoded subset.
 */
export function toCatalogTools(
  yourTools: BillingToolCard[],
  availableToAdd: BillingAvailableCard[]
): CatalogTool[] {
  const active = new Map<string, BillingToolCard>(yourTools.map((t) => [t.toolSlug, t]));
  const pending = new Map<string, BillingAvailableCard>(availableToAdd.map((t) => [t.toolSlug, t]));
  return TOOLS.filter((t) => !t.comingSoon).map((t) => {
    const owned = active.get(t.slug);
    const addable = pending.get(t.slug);
    const free = owned?.free ?? addable?.free ?? null;
    return {
      toolSlug: t.slug,
      displayName: owned?.displayName ?? addable?.displayName ?? t.name,
      description: owned?.description ?? addable?.description ?? t.description,
      icon: owned?.icon ?? addable?.icon ?? t.icon,
      freeBadge: free?.badge ?? null,
      freeAllowance: free ? `Free: ${free.allowance}` : null,
      entitled: owned !== undefined,
      claimable: addable?.claimable ?? false,
    };
  });
}
