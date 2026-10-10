import { getToolFreePolicy } from "@/config/tools/policy";

/**
 * Free-tier marketing content — single source for all public Free messaging.
 *
 * Numeric allowances are derived from the authoritative freemium policy
 * registry (`src/config/tools/policy.ts`), so marketing copy cannot drift
 * from enforced limits. Static wording (tool names, unlimited claims) lives
 * here once and is reused by the homepage, tool catalog, tool pages, and
 * pricing — never re-declared per component. Tests pin registry equality.
 *
 * Presentation only: no entitlement decisions, no pricing changes, no
 * Free-limit changes. Prize Pool Splitter has no registry limits by design
 * (unlimited, unmetered) and is presented as such.
 */

export interface FreeTierInfo {
  /** Canonical internal slug (matches the freemium policy registry). */
  readonly slug: string;
  /** Public marketing slug (/tools/:slug); differs from internal slug for prize-splitter. */
  readonly marketingSlug: string;
  /** Customer-facing tool name. */
  readonly name: string;
  /** Compact badge text, e.g. "Free forever". */
  readonly badge: string;
  /** One-line Free allowance for cards and catalog rows. */
  readonly allowance: string;
  /** Fuller allowance for tool pages and pricing (may restate allowance). */
  readonly details: string;
}

function sponsorshipAllowance(): Pick<FreeTierInfo, "allowance" | "details"> {
  const limits = getToolFreePolicy("sponsor-sentinel")?.limits;
  const campaigns = limits?.activeCampaigns ?? 1;
  const channels = limits?.connectedChannels ?? 1;
  const checks = limits?.monthlyChecks ?? 10;
  return {
    allowance: `${campaigns} campaign · ${channels} channel · ${checks} checks/month`,
    details: `${campaigns} active campaign · ${channels} connected channel · ${checks} checks/month · 7-day history`,
  };
}

function prizeAllowance(): Pick<FreeTierInfo, "allowance" | "details"> {
  return {
    allowance: "Unlimited calculations · sharing · CSV",
    details: "Unlimited calculations · unlimited share links · unlimited CSV export",
  };
}

function tieBreakerAllowance(): Pick<FreeTierInfo, "allowance" | "details"> {
  const locks = getToolFreePolicy("tie-breaker")?.limits.lockedOfficialRecordsPerMonth ?? 3;
  return {
    allowance: `${locks} official results/month`,
    details: `${locks} locked official records per workspace month · latest 3 visible · unlimited drafts`,
  };
}

function draftBanAllowance(): Pick<FreeTierInfo, "allowance" | "details"> {
  const limits = getToolFreePolicy("draft-ban")?.limits;
  const matches = limits?.completedMatchesPerMonth ?? 1;
  const templates = limits?.customTemplatesMax ?? 3;
  return {
    allowance: `${matches} completed match/month`,
    details: `${matches} completed match per workspace month · latest 5 visible · ${templates} custom templates · starter included`,
  };
}

export const FREE_TIERS: ReadonlyArray<FreeTierInfo> = [
  { slug: "sponsor-sentinel", marketingSlug: "sponsorship-tracking", name: "Sponsorship Tracking", badge: "Free forever", ...sponsorshipAllowance() },
  { slug: "prize-splitter", marketingSlug: "prize-pool-splitter", name: "Prize Pool Splitter", badge: "Free forever", ...prizeAllowance() },
  { slug: "tie-breaker", marketingSlug: "tie-breaker", name: "Tie-Breaker Resolver", badge: "Free forever", ...tieBreakerAllowance() },
  { slug: "draft-ban", marketingSlug: "draft-ban", name: "Draft & Ban", badge: "Free forever", ...draftBanAllowance() },
];

export function freeTierBySlug(slug: string): FreeTierInfo | null {
  return FREE_TIERS.find((t) => t.slug === slug) ?? null;
}

export function freeTierByMarketingSlug(slug: string): FreeTierInfo | null {
  return FREE_TIERS.find((t) => t.marketingSlug === slug) ?? null;
}
