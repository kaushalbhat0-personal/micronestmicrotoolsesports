// P5 prize-pool splitter — pure deterministic distribution engine.
// Integer minor-unit arithmetic only (paise/cents): no floating point
// anywhere. Percentage shares use the largest-remainder method so the
// distributed total is exact: floors first, then leftover minor units go to
// the largest fractional remainders (ties break toward the better position).
// Anything undistributed is reported as unallocated — never absorbed.

import type { ParsedPrizePool, ToolCurrency } from "./schema";

export interface PrizeShare {
  readonly position: number;
  readonly amountMinor: number;
}

export interface PrizeDistribution {
  readonly totalMinor: number;
  readonly currency: ToolCurrency;
  readonly shares: ReadonlyArray<PrizeShare>;
  readonly distributedMinor: number;
  readonly unallocatedMinor: number;
}

export class PrizePoolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrizePoolError";
  }
}

/**
 * Distribute the pool. Defensive: re-validates every bound so the engine is
 * safe to call without the form schema (throws PrizePoolError, never NaN).
 */
export function distributePrizePool(input: ParsedPrizePool): PrizeDistribution {
  const { totalMinor, currency, rows } = input;
  if (!Number.isInteger(totalMinor) || totalMinor < 0) {
    throw new PrizePoolError("Total prize pool must be a non-negative integer in minor units.");
  }
  if (rows.length === 0 || rows.length > 32) {
    throw new PrizePoolError("Provide between 1 and 32 payout rows.");
  }
  const positions = rows.map((row) => row.position);
  if (
    positions.some((position) => !Number.isInteger(position) || position < 1 || position > 64) ||
    new Set(positions).size !== positions.length
  ) {
    throw new PrizePoolError("Positions must be unique whole numbers from 1 to 64.");
  }

  let fixedMinor = 0;
  let totalBps = 0;
  for (const row of rows) {
    if (row.kind === "fixed") {
      if (!Number.isInteger(row.fixedMinor) || row.fixedMinor < 0) {
        throw new PrizePoolError("Fixed amounts must be non-negative integers in minor units.");
      }
      fixedMinor += row.fixedMinor;
    } else {
      if (!Number.isInteger(row.bps) || row.bps < 0 || row.bps > 10_000) {
        throw new PrizePoolError("Percentages must be between 0 and 10000 basis points.");
      }
      totalBps += row.bps;
    }
  }
  if (totalBps > 10_000) {
    throw new PrizePoolError("Percentages may sum to at most 100%.");
  }
  if (fixedMinor > totalMinor) {
    throw new PrizePoolError("Fixed amounts may not exceed the total prize pool.");
  }

  // Percentage shares of the FULL total (not of the post-fixed remainder):
  // each share = floor(total * bps / 10000), leftover by largest remainder.
  const percentRows = rows.filter(
    (row): row is Extract<ParsedPrizePool["rows"][number], { kind: "percent" }> =>
      row.kind === "percent",
  );
  const floors = percentRows.map((row) => {
    const numerator = totalMinor * row.bps;
    return {
      position: row.position,
      floor: Math.floor(numerator / 10_000),
      remainder: numerator % 10_000,
    };
  });
  const floorSum = floors.reduce((sum, entry) => sum + entry.floor, 0);
  const exactPercentSum = Math.floor((totalMinor * totalBps) / 10_000);
  let leftover = exactPercentSum - floorSum;
  const byRemainder = [...floors].sort(
    (a, b) => b.remainder - a.remainder || a.position - b.position,
  );
  const bonus = new Map<number, number>();
  for (const entry of byRemainder) {
    if (leftover <= 0) {
      break;
    }
    bonus.set(entry.position, 1);
    leftover -= 1;
  }

  const shares: PrizeShare[] = rows.map((row) => {
    if (row.kind === "fixed") {
      return { position: row.position, amountMinor: row.fixedMinor };
    }
    const entry = floors.find((item) => item.position === row.position);
    const base = entry?.floor ?? 0;
    return { position: row.position, amountMinor: base + (bonus.get(row.position) ?? 0) };
  });
  shares.sort((a, b) => a.position - b.position);

  const distributedMinor = shares.reduce((sum, share) => sum + share.amountMinor, 0);
  const unallocatedMinor = totalMinor - distributedMinor;
  if (unallocatedMinor < 0) {
    throw new PrizePoolError("Distribution exceeds the total prize pool.");
  }
  return { totalMinor, currency, shares, distributedMinor, unallocatedMinor };
}

export function ordinalLabel(position: number): string {
  const mod100 = position % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${position}th`;
  }
  switch (position % 10) {
    case 1:
      return `${position}st`;
    case 2:
      return `${position}nd`;
    case 3:
      return `${position}rd`;
    default:
      return `${position}th`;
  }
}
