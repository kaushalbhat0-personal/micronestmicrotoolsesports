// P5 prize-pool splitter — input schemas (Zod, form-friendly raw strings).
// Money enters as decimal-major strings ("250000", "12.50") and is parsed to
// integer minor units WITHOUT floating point: split on ".", pad, compare as
// BigInt where bounds demand it. Percentages enter as "12.5" and become
// integer basis points (1bp = 0.01%).

import { z } from "zod";

export const SUPPORTED_TOOL_CURRENCIES = ["INR", "USD"] as const;

export type ToolCurrency = (typeof SUPPORTED_TOOL_CURRENCIES)[number];

export function isToolCurrency(value: unknown): value is ToolCurrency {
  return value === "INR" || value === "USD";
}

/** Upper clamp shared with the P3 money posture (minor units). */
export const MAX_PRIZE_MINOR = 1_000_000_000_000;

export const MAX_PAYOUT_ROWS = 32;
export const MAX_POSITION = 64;

const MAJOR_PATTERN = /^(\d{1,12})(?:\.(\d{1,2}))?$/;
const PERCENT_PATTERN = /^(\d{1,3})(?:\.(\d{1,2}))?$/;

/** "250000.50" -> 25000050n-style minor units, or null when malformed. */
export function parseMajorToMinor(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, "");
  const match = MAJOR_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }
  const [, whole, fraction = ""] = match;
  const minor = Number(`${whole}${fraction.padEnd(2, "0")}`);
  if (!Number.isSafeInteger(minor) || minor < 0 || minor > MAX_PRIZE_MINOR) {
    return null;
  }
  return minor;
}

/** "12.5" -> 1250bp, or null when malformed or above 100%. */
export function parsePercentToBps(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, "");
  const match = PERCENT_PATTERN.exec(trimmed);
  if (!match) {
    return null;
  }
  const [, whole, fraction = ""] = match;
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(bps) || bps < 0 || bps > 10_000) {
    return null;
  }
  return bps;
}

export const currencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((value): value is ToolCurrency => isToolCurrency(value), {
    message: "Currency must be INR or USD",
  });

const prizeRowSchema = z
  .object({
    position: z.coerce.number().int().min(1).max(MAX_POSITION),
    mode: z.enum(["fixed", "percent"]),
    amount: z.string().trim().max(16),
    percent: z.string().trim().max(7),
  })
  .strict()
  .superRefine((row, ctx) => {
    if (row.mode === "fixed" && parseMajorToMinor(row.amount) === null) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Enter a fixed amount like 50000 or 1250.50",
      });
    }
    if (row.mode === "percent" && parsePercentToBps(row.percent) === null) {
      ctx.addIssue({
        code: "custom",
        path: ["percent"],
        message: "Enter a percentage from 0 to 100 with up to two decimals",
      });
    }
  });

export type PrizeRowInput = z.infer<typeof prizeRowSchema>;

export const prizePoolFormSchema = z
  .object({
    total: z.string().trim().min(1).max(16),
    currency: currencySchema,
    rows: z.array(prizeRowSchema).min(1).max(MAX_PAYOUT_ROWS),
  })
  .strict()
  .superRefine((form, ctx) => {
    const totalMinor = parseMajorToMinor(form.total);
    if (totalMinor === null) {
      ctx.addIssue({
        code: "custom",
        path: ["total"],
        message: "Enter a total like 100000 or 2500.50",
      });
      return;
    }
    const positions = form.rows.map((row) => row.position);
    if (new Set(positions).size !== positions.length) {
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message: "Each finishing position may appear only once",
      });
    }
    let fixedMinor = 0;
    let totalBps = 0;
    for (const row of form.rows) {
      if (row.mode === "fixed") {
        fixedMinor += parseMajorToMinor(row.amount) ?? 0;
      } else {
        totalBps += parsePercentToBps(row.percent) ?? 0;
      }
    }
    if (totalBps > 10_000) {
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message: "Percentages may sum to at most 100%",
      });
    }
    if (fixedMinor > totalMinor) {
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message: "Fixed amounts may not exceed the total prize pool",
      });
    }
  });

export type PrizePoolFormInput = z.infer<typeof prizePoolFormSchema>;

/** Engine-ready parsed model (all amounts integer minor units). */
export interface ParsedPrizePool {
  totalMinor: number;
  currency: ToolCurrency;
  rows: Array<
    | { position: number; kind: "fixed"; fixedMinor: number }
    | { position: number; kind: "percent"; bps: number }
  >;
}

export function toParsedPrizePool(form: PrizePoolFormInput): ParsedPrizePool | null {
  const totalMinor = parseMajorToMinor(form.total);
  if (totalMinor === null || !isToolCurrency(form.currency)) {
    return null;
  }
  const rows: ParsedPrizePool["rows"] = [];
  for (const row of form.rows) {
    if (row.mode === "fixed") {
      const fixedMinor = parseMajorToMinor(row.amount);
      if (fixedMinor === null) {
        return null;
      }
      rows.push({ position: row.position, kind: "fixed", fixedMinor });
    } else {
      const bps = parsePercentToBps(row.percent);
      if (bps === null) {
        return null;
      }
      rows.push({ position: row.position, kind: "percent", bps });
    }
  }
  return { totalMinor, currency: form.currency, rows };
}
