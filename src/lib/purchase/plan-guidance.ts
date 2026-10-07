/**
 * Purchase guidance — customer-facing purchase context.
 *
 * Maps a plan slug prefix to the tool a customer actually bought:
 * human tool name, where to open it, and the first step after payment.
 * Pure data + tiny helpers. No DB, no secrets, no pricing authority —
 * the server-side plan catalog remains the single source of truth and
 * every consumer must validate the slug against it before displaying.
 */

export interface PurchaseGuide {
  /** Customer-facing tool name. Never a slug. */
  readonly toolName: string;
  /** Workspace-relative tool route, e.g. `/dashboard/acme/draft-ban`. */
  readonly toolRoute: (orgSlug: string) => string;
  /** One first-use instruction shown after payment. */
  readonly firstStep: string;
}

const GUIDES: ReadonlyArray<{ prefix: string; guide: PurchaseGuide }> = [
  {
    prefix: "sponsorship-tracking",
    guide: {
      toolName: "Sponsorship Tracking",
      toolRoute: (orgSlug: string) => `/dashboard/${orgSlug}/sponsor-sentinel/campaigns`,
      firstStep: "Next: connect your creator channels, then create your first sponsorship check.",
    },
  },
  {
    prefix: "prize-pool-splitter",
    guide: {
      toolName: "Prize Pool Splitter",
      toolRoute: (orgSlug: string) => `/dashboard/${orgSlug}/prize-splitter`,
      firstStep: "Next: enter your prize pool and choose how you want to split it.",
    },
  },
  {
    prefix: "draft-ban",
    guide: {
      toolName: "Draft & Ban",
      toolRoute: (orgSlug: string) => `/dashboard/${orgSlug}/draft-ban`,
      firstStep: "Next: choose a draft setup, enter the two teams and map pool, then start the draft.",
    },
  },
  {
    prefix: "tie-breaker",
    guide: {
      toolName: "Tie-Breaker Resolver",
      toolRoute: (orgSlug: string) => `/dashboard/${orgSlug}/tie-breaker`,
      firstStep: "Next: create a competition, set your rule order, add teams, and enter results.",
    },
  },
  {
    prefix: "all-access",
    guide: {
      toolName: "All Access",
      toolRoute: (orgSlug: string) => `/dashboard/${orgSlug}`,
      firstStep: "Next: open any tool in your workspace sidebar to start.",
    },
  },
];

/** Match a plan slug (e.g. `draft-ban-monthly`) to purchase guidance. Returns null when unknown. */
export function getPurchaseGuide(planSlug: string | null | undefined): PurchaseGuide | null {
  if (!planSlug) return null;
  const found = GUIDES.find(({ prefix }) => planSlug === prefix || planSlug.startsWith(`${prefix}-`));
  return found?.guide ?? null;
}

/**
 * Internal tool slugs covered by a plan slug. Code-only mapping used for
 * access checks — never render these slugs to customers.
 */
export function coveredToolSlugs(planSlug: string | null | undefined): string[] {
  if (!planSlug) return [];
  if (planSlug === "all-access" || planSlug.startsWith("all-access-")) {
    return ["sponsor-sentinel", "prize-splitter", "draft-ban"];
  }
  const found = GUIDES.find(({ prefix }) => prefix !== "all-access" && (planSlug === prefix || planSlug.startsWith(`${prefix}-`)));
  if (!found) return [];
  if (found.prefix === "sponsorship-tracking") return ["sponsor-sentinel"];
  if (found.prefix === "prize-pool-splitter") return ["prize-splitter"];
  if (found.prefix === "tie-breaker") return ["tie-breaker"];
  return ["draft-ban"];
}

/** Format minor currency units for customer display, e.g. 79900 INR → `₹799`. */
export function formatPlanPrice(amountMinor: number, currency: string): string {
  const amount = amountMinor / 100;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/** Human billing-period label. Never render a raw period slug elsewhere. */
export function periodLabel(billingPeriod: string): string {
  return billingPeriod === "yearly" ? "year" : "month";
}
