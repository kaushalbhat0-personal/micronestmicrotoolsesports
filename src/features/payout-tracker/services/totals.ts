import type { PayoutCurrency } from "../types";
import { PAYOUT_CURRENCIES, PAYOUT_MINOR_FACTOR } from "../types";

/**
 * Prize Payout Tracker — money totals (pure, no React, no Supabase).
 * All amounts are integer minor units (paise/cents). No floating point.
 */

export function toMinor(amountMajor: number): number {
  return Math.round(amountMajor * PAYOUT_MINOR_FACTOR);
}

export function fromMinor(amountMinor: number): number {
  return amountMinor / PAYOUT_MINOR_FACTOR;
}

/** Format integer minor units using the currency locale + symbol. */
export function formatMinor(amountMinor: number, currency: PayoutCurrency): string {
  const config = PAYOUT_CURRENCIES[currency];
  const formatted = new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(fromMinor(amountMinor));
  return `${config.symbol}${formatted}`;
}

export interface PayoutTotals {
  readonly totalMinor: number;
  readonly paidMinor: number;
  readonly remainingMinor: number;
  readonly paidCount: number;
  readonly totalCount: number;
  /** Integer percent 0–100, floored (progress bars never over-claim). */
  readonly percentPaid: number;
}

export function calculateTotals(
  recipients: ReadonlyArray<{ amount_minor: number; status: string }>,
): PayoutTotals {
  let totalMinor = 0;
  let paidMinor = 0;
  let paidCount = 0;
  for (const r of recipients) {
    totalMinor += r.amount_minor;
    if (r.status === "paid") {
      paidMinor += r.amount_minor;
      paidCount += 1;
    }
  }
  const remainingMinor = totalMinor - paidMinor;
  const percentPaid = totalMinor > 0 ? Math.floor((paidMinor / totalMinor) * 100) : 0;
  return Object.freeze({
    totalMinor,
    paidMinor,
    remainingMinor,
    paidCount,
    totalCount: recipients.length,
    percentPaid,
  });
}
