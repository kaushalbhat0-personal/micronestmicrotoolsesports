import { addBillingPeriod, type BillingPeriod } from "./period";

/**
 * Calculate renewed expiry for manual monthly/yearly.
 * Rules:
 * - no existing expiry (null) → now + period
 * - existing < now (expired) → now + period
 * - existing > now (active) → existing + period
 * Conceptually max(existing, now) + period, timezone-safe via Date.
 */
export function calculateRenewedExpiry(
  existingExpiresAt: Date | null | undefined,
  now: Date,
  billingPeriod: BillingPeriod
): Date {
  const base = existingExpiresAt && existingExpiresAt > now ? existingExpiresAt : now;
  return addBillingPeriod(base, billingPeriod);
}
