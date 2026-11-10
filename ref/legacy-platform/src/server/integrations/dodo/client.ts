/**
 * Dodo Payments — integration boundary (mirrors Razorpay/Stripe boundary).
 * Canonical config source: validated server env when available,
 * falls back to raw process.env in test environments where server env
 * is not yet configured.
 *
 * Server-only. Never import from client components.
 */

import { getServerEnv } from "@/lib/env/server";

export type DodoEnvironment = "test_mode" | "live_mode";

export interface DodoConfig {
  apiKey: string;
  webhookKey?: string;
  environment: DodoEnvironment;
  returnUrl?: string;
}

function readDodoFromEnv(): DodoConfig | null {
  let apiKey: string | undefined;
  let webhookKey: string | undefined;
  let environment: string | undefined;
  let returnUrl: string | undefined;
  try {
    const env = getServerEnv() as Record<string, string | undefined>;
    apiKey = env.DODO_PAYMENTS_API_KEY ?? process.env.DODO_PAYMENTS_API_KEY;
    webhookKey = env.DODO_PAYMENTS_WEBHOOK_KEY ?? process.env.DODO_PAYMENTS_WEBHOOK_KEY;
    environment = env.DODO_PAYMENTS_ENVIRONMENT ?? process.env.DODO_PAYMENTS_ENVIRONMENT;
    returnUrl = env.DODO_PAYMENTS_RETURN_URL ?? process.env.DODO_PAYMENTS_RETURN_URL;
  } catch {
    apiKey = process.env.DODO_PAYMENTS_API_KEY;
    webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
    environment = process.env.DODO_PAYMENTS_ENVIRONMENT;
    returnUrl = process.env.DODO_PAYMENTS_RETURN_URL;
  }
  if (!apiKey) return null;
  const resolvedEnv: DodoEnvironment = environment === "live_mode" ? "live_mode" : "test_mode";
  return {
    apiKey,
    ...(webhookKey !== undefined ? { webhookKey } : {}),
    environment: resolvedEnv,
    ...(returnUrl !== undefined ? { returnUrl } : {}),
  };
}

export function getDodoConfig(): DodoConfig | null {
  return readDodoFromEnv();
}

/**
 * Fail-fast helper for checkout/webhook hot paths.
 * Throws when Dodo is not configured.
 */
export function requireDodoConfig(): DodoConfig {
  const cfg = readDodoFromEnv();
  if (!cfg) throw new Error("Dodo Payments not configured — missing DODO_PAYMENTS_API_KEY");
  return cfg;
}

/**
 * Plan slug → Dodo product ID map (12 V1 products, one per billing period).
 * Dodo pricing is immutable per product, so Monthly and Yearly are separate
 * products. Server-only: populated from env, never client-supplied.
 * Missing product ID fails checkout closed for that plan.
 */
const DODO_PRODUCT_ENV_BY_PLAN_SLUG: Record<string, string> = {
  "sponsorship-tracking-monthly": "DODO_PRODUCT_SPONSORSHIP_TRACKING_MONTHLY",
  "sponsorship-tracking-yearly": "DODO_PRODUCT_SPONSORSHIP_TRACKING_YEARLY",
  // International V1 — Sponsorship Tracking USD only. No other tool has a
  // USD mapping; unknown slugs resolve to null and fail checkout closed.
  "sponsorship-tracking-monthly-usd": "DODO_PRODUCT_SPONSORSHIP_TRACKING_MONTHLY_USD",
  "sponsorship-tracking-yearly-usd": "DODO_PRODUCT_SPONSORSHIP_TRACKING_YEARLY_USD",
  "prize-pool-splitter-monthly": "DODO_PRODUCT_PRIZE_POOL_SPLITTER_MONTHLY",
  "prize-pool-splitter-yearly": "DODO_PRODUCT_PRIZE_POOL_SPLITTER_YEARLY",
  "draft-ban-monthly": "DODO_PRODUCT_DRAFT_BAN_MONTHLY",
  "draft-ban-yearly": "DODO_PRODUCT_DRAFT_BAN_YEARLY",
  "tie-breaker-monthly": "DODO_PRODUCT_TIE_BREAKER_MONTHLY",
  "tie-breaker-yearly": "DODO_PRODUCT_TIE_BREAKER_YEARLY",
  "prize-payout-tracker-monthly": "DODO_PRODUCT_PRIZE_PAYOUT_TRACKER_MONTHLY",
  "prize-payout-tracker-yearly": "DODO_PRODUCT_PRIZE_PAYOUT_TRACKER_YEARLY",
  "all-access-monthly": "DODO_PRODUCT_ALL_ACCESS_MONTHLY",
  "all-access-yearly": "DODO_PRODUCT_ALL_ACCESS_YEARLY",
};

function readProductId(envVar: string): string | null {
  try {
    const env = getServerEnv() as Record<string, string | undefined>;
    return env[envVar] ?? process.env[envVar] ?? null;
  } catch {
    return process.env[envVar] ?? null;
  }
}

/**
 * Resolve the Dodo product ID for a plan slug.
 * Returns null when the plan has no Dodo product mapping or the product
 * ID is not configured — callers must fail closed.
 */
export function getDodoProductIdForPlanSlug(planSlug: string): string | null {
  const envVar = DODO_PRODUCT_ENV_BY_PLAN_SLUG[planSlug];
  if (!envVar) return null;
  const productId = readProductId(envVar);
  if (!productId || productId.trim() === "") return null;
  return productId.trim();
}
