export type BillingPeriod = "monthly" | "yearly";

/**
 * Calendar-based period addition — deterministic.
 * Monthly: +1 calendar month, yearly: +1 calendar year.
 * End-of-month is clamped to last day of target month.
 * Example: 2026-01-31 + monthly = 2026-02-28 (2026 not leap), 2024-01-31 + monthly = 2024-02-29
 */
export function addBillingPeriod(date: Date, period: BillingPeriod): Date {
  // Use UTC to be timezone/DST-safe and deterministic
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  const month = d.getUTCMonth();
  const year = d.getUTCFullYear();

  if (period === "monthly") {
    const targetMonth = month + 1;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    const clampedDay = Math.min(day, lastDay);
    return new Date(
      Date.UTC(
        targetYear,
        normalizedMonth,
        clampedDay,
        d.getUTCHours(),
        d.getUTCMinutes(),
        d.getUTCSeconds(),
        d.getUTCMilliseconds()
      )
    );
  }

  if (period === "yearly") {
    const targetYear = year + 1;
    const lastDay = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
    const clampedDay = Math.min(day, lastDay);
    return new Date(
      Date.UTC(targetYear, month, clampedDay, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds())
    );
  }

  throw new Error(`Unknown billing period: ${period}`);
}
