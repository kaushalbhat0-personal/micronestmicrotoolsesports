import type {
  Currency,
  SplitInput,
  SplitResult,
  CalculatedPlacement,
  PlacementInput,
} from "../types";
import {
  CURRENCY_LOCALES,
  MAX_PRIZE_POOL,
  PERCENTAGE_DECIMALS,
  formatPlacementLabel,
} from "../types";

/**
 * Prize Pool Splitter — Deterministic Calculation Engine
 *
 * Pure function. No React, no Supabase, no browser APIs.
 *
 * Money handling:
 * - All amounts converted to minor units (cents/paise) as integers: minor = Math.round(amount * 100)
 * - Supported currencies all use 2 decimals for MVP.
 * - Floating-point percentages handled via largest-remainder (Hamilton) method:
 *   1. Raw payout in minor units = poolMinor * percentage / 100 (float)
 *   2. Floor each to integer minor units
 *   3. Distribute remaining minor units (poolMinor - sumFloored) one by one to placements
 *      with largest fractional part, tie-break by position (top placement first)
 *   4. Ensures sum(displayed payouts) === prize pool exactly, no 0.01 drift
 *
 * Precision policy (hardened post-audit):
 * - Percentages canonicalize to 2 decimals (Math.round(pct*100)/100) before validation & calc.
 *   This makes displayed %, validation, calculation, and share state deterministic.
 *   Inputs like 33.33333 round to 33.33; total must still be 100.00 within EPS 0.001.
 * - Prize pool capped at MAX_PRIZE_POOL (1_000_000_000) to keep minor < MAX_SAFE_INTEGER.
 *
 * Rounding policy is documented here and tested exhaustively.
 */

const MINOR_FACTOR = 100;

export function toMinor(amount: number): number {
  return Math.round(amount * MINOR_FACTOR);
}

export function fromMinor(minor: number): number {
  return minor / MINOR_FACTOR;
}

export function canonicalPct(pct: number): number {
  if (!Number.isFinite(pct)) return pct;
  return Math.round(pct * Math.pow(10, PERCENTAGE_DECIMALS)) / Math.pow(10, PERCENTAGE_DECIMALS);
}

export function validateInput(input: SplitInput): { valid: boolean; errors: { field: string; message: string }[] } {
  const errors: { field: string; message: string }[] = [];

  // prizePool
  if (input.prizePool === null || input.prizePool === undefined || typeof input.prizePool !== "number" || Number.isNaN(input.prizePool)) {
    errors.push({ field: "prizePool", message: "Prize pool is required" });
  } else if (!Number.isFinite(input.prizePool)) {
    errors.push({ field: "prizePool", message: "Prize pool must be a finite number" });
  } else if (input.prizePool <= 0) {
    errors.push({ field: "prizePool", message: "Prize pool must be greater than 0" });
  } else if (input.prizePool > MAX_PRIZE_POOL) {
    errors.push({ field: "prizePool", message: `Prize pool is too large (max ${new Intl.NumberFormat("en-IN").format(MAX_PRIZE_POOL)})` });
  } else {
    const poolMinor = toMinor(input.prizePool);
    if (!Number.isSafeInteger(poolMinor)) {
      errors.push({ field: "prizePool", message: "Prize pool causes unsafe integer — reduce amount" });
    }
  }

  // currency
  const validCurrencies: Currency[] = ["INR", "USD", "EUR", "GBP"];
  if (!validCurrencies.includes(input.currency)) {
    errors.push({ field: "currency", message: "Invalid currency" });
  }

  // method-specific
  if (input.method === "equal") {
    const n = input.equalCount;
    if (n === undefined || n === null || typeof n !== "number" || Number.isNaN(n) || !Number.isFinite(n)) {
      errors.push({ field: "equalCount", message: "Number of recipients is required" });
    } else if (!Number.isInteger(n) || n <= 0) {
      errors.push({ field: "equalCount", message: "Recipients must be a positive integer" });
    } else if (n > 1000) {
      errors.push({ field: "equalCount", message: "Too many recipients (max 1000)" });
    }
  } else {
    if (!input.placements || input.placements.length === 0) {
      errors.push({ field: "placements", message: "At least one placement is required" });
    } else {
      if (input.placements.length > 100) {
        errors.push({ field: "placements", message: "Too many placements (max 100)" });
      }
      const seen = new Set<string>();
      let total = 0;
      for (let i = 0; i < input.placements.length; i++) {
        const p = input.placements[i] as PlacementInput | undefined;
        if (!p) continue;
        const field = `placements.${i}.percentage`;
        if (typeof p.percentage !== "number" || Number.isNaN(p.percentage) || !Number.isFinite(p.percentage)) {
          errors.push({ field, message: `Placement ${i + 1}: percentage must be a finite number` });
          continue;
        }
        const cp = canonicalPct(p.percentage);
        if (cp < 0) {
          errors.push({ field, message: `Placement ${i + 1}: percentage cannot be negative` });
        }
        if (cp > 100) {
          errors.push({ field, message: `Placement ${i + 1}: percentage cannot exceed 100` });
        }
        total += cp;
        const label = p.label.trim().toLowerCase();
        if (seen.has(label)) {
          errors.push({ field: `placements.${i}.label`, message: `Duplicate placement label: ${p.label}` });
        } else {
          seen.add(label);
        }
      }
      const EPS = 0.001;
      if (Math.abs(total - 100) > EPS) {
        errors.push({ field: "placements", message: `Total must equal 100% (currently ${Number(total.toFixed(2))}%)` });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Core calculation — assumes validated input (but re-validates defensively)
 * Returns immutable SplitResult or throws on invalid.
 */
export function calculateSplit(input: SplitInput): SplitResult {
  const validation = validateInput(input);
  if (!validation.valid) {
    const msg = validation.errors.map((e) => e.message).join("; ");
    throw new Error(`Validation failed: ${msg}`);
  }

  const poolMinor = toMinor(input.prizePool);
  const placements: CalculatedPlacement[] = [];

  if (input.method === "equal") {
    const n = input.equalCount as number;
    const equalPct = 100 / n;
    const canonicalEqualPct = canonicalPct(equalPct);
    const raws = Array.from({ length: n }, () => poolMinor * equalPct / 100);
    const floored = raws.map((r) => Math.floor(r));
    const fractions = raws.map((r, idx) => ({ idx, frac: r - Math.floor(r) }));
    const remaining = poolMinor - floored.reduce((a, b) => a + b, 0);
    fractions.sort((a, b) => b.frac - a.frac || a.idx - b.idx);
    const extra = new Array(n).fill(0) as number[];
    for (let i = 0; i < remaining; i++) {
      const target = fractions[i % n];
      if (target) extra[target.idx] = (extra[target.idx] as number) + 1;
    }
    for (let i = 0; i < n; i++) {
      const minor = (floored[i] as number) + (extra[i] as number);
      placements.push({
        position: i + 1,
        label: formatPlacementLabel(i + 1),
        percentage: i === 0 ? canonicalEqualPct : Number(canonicalEqualPct.toFixed(2)),
        payoutMinor: minor,
        payout: fromMinor(minor),
        remainderDistributed: extra[i] as number,
      });
    }
  } else {
    const canonicalPlacements = input.placements.map((p) => ({ ...p, percentage: canonicalPct(p.percentage) }));
    const raws = canonicalPlacements.map((p) => poolMinor * p.percentage / 100);
    const floored = raws.map((r) => Math.floor(r));
    const fractions = raws.map((r, idx) => ({ idx, frac: r - Math.floor(r) }));
    const remaining = poolMinor - floored.reduce((a, b) => a + b, 0);
    fractions.sort((a, b) => b.frac - a.frac || a.idx - b.idx);
    const extra = new Array(raws.length).fill(0) as number[];
    for (let i = 0; i < remaining; i++) {
      const target = fractions[i % fractions.length];
      if (target) extra[target.idx] = (extra[target.idx] as number) + 1;
    }
    for (let i = 0; i < canonicalPlacements.length; i++) {
      const p = canonicalPlacements[i] as PlacementInput;
      const minor = (floored[i] as number) + (extra[i] as number);
      placements.push({
        position: i + 1,
        label: p.label,
        percentage: p.percentage,
        payoutMinor: minor,
        payout: fromMinor(minor),
        remainderDistributed: extra[i] as number,
      });
    }
  }

  const totalDistributedMinor = placements.reduce((a, p) => a + p.payoutMinor, 0);
  const totalPercentage = input.method === "equal"
    ? 100
    : input.placements.reduce((a, p) => a + p.percentage, 0);

  return Object.freeze({
    prizePool: input.prizePool,
    prizePoolMinor: poolMinor,
    currency: input.currency,
    method: input.method,
    placements: Object.freeze(placements) as CalculatedPlacement[],
    totalPercentage: Number(totalPercentage.toFixed(4)),
    totalDistributed: fromMinor(totalDistributedMinor),
    totalDistributedMinor,
    remaining: fromMinor(poolMinor - totalDistributedMinor),
    remainingMinor: poolMinor - totalDistributedMinor,
    isBalanced: totalDistributedMinor === poolMinor && Math.abs(totalPercentage - 100) < 0.001,
  }) as SplitResult;
}

/** Helper for UI: format money using currency locale + symbol */
export function formatMoney(amount: number, currency: Currency): string {
  const symbols: Record<Currency, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
  const symbol = symbols[currency];
  const locale = CURRENCY_LOCALES[currency] ?? "en-IN";
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${symbol}${formatted}`;
}

/** For copy-to-clipboard text generation — plain (no context) kept for backwards compat */
export function buildCopyText(result: SplitResult): string {
  const symbols: Record<Currency, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
  const sym = symbols[result.currency];
  const locale = CURRENCY_LOCALES[result.currency] ?? "en-IN";
  const nf = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nfPool = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lines: string[] = [];
  lines.push(`Prize Pool: ${sym}${nfPool.format(result.prizePool)}`);
  lines.push("");
  for (const p of result.placements) {
    const payout = `${sym}${nf.format(p.payout)}`;
    lines.push(`${p.label} — ${p.percentage}% — ${payout}`);
  }
  lines.push("");
  lines.push(`Total Distributed: ${sym}${nf.format(result.totalDistributed)}`);
  if (result.remainingMinor !== 0) lines.push(`Remaining: ${sym}${result.remaining.toFixed(2)}`);
  return lines.join("\n");
}
