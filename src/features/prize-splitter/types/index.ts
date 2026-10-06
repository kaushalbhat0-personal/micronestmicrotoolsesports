export type Currency = "INR" | "USD" | "EUR" | "GBP";

export interface CurrencyConfig {
  code: Currency;
  symbol: string;
  label: string;
  decimals: number;
}

export const CURRENCIES: Record<Currency, CurrencyConfig> = {
  INR: { code: "INR", symbol: "₹", label: "Indian Rupee", decimals: 2 },
  USD: { code: "USD", symbol: "$", label: "US Dollar", decimals: 2 },
  EUR: { code: "EUR", symbol: "€", label: "Euro", decimals: 2 },
  GBP: { code: "GBP", symbol: "£", label: "British Pound", decimals: 2 },
};

export type DistributionMethod = "percentage" | "equal" | "ranked" | "custom";

export interface PlacementInput {
  label: string;
  percentage: number;
}

export interface SplitInput {
  prizePool: number;
  currency: Currency;
  method: DistributionMethod;
  placements: PlacementInput[];
  equalCount?: number;
}

export interface CalculatedPlacement {
  position: number;
  label: string;
  percentage: number;
  payout: number;
  payoutMinor: number;
  remainderDistributed: number;
}

export interface SplitResult {
  prizePool: number;
  prizePoolMinor: number;
  currency: Currency;
  method: DistributionMethod;
  placements: CalculatedPlacement[];
  totalPercentage: number;
  totalDistributed: number;
  totalDistributedMinor: number;
  remaining: number;
  remainingMinor: number;
  isBalanced: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** Ranked preset definition — starting points only, user can edit */
export interface RankedPreset {
  id: string;
  label: string;
  count: number;
  percentages: number[];
}

export const RANKED_PRESETS: RankedPreset[] = [
  { id: "top3", label: "Top 3", count: 3, percentages: [50, 30, 20] },
  { id: "top4", label: "Top 4", count: 4, percentages: [40, 30, 20, 10] },
  { id: "top5", label: "Top 5", count: 5, percentages: [35, 25, 20, 12, 8] },
  { id: "top8", label: "Top 8", count: 8, percentages: [30, 20, 15, 10, 8, 7, 5, 5] },
  { id: "top10", label: "Top 10", count: 10, percentages: [25, 18, 15, 10, 8, 6, 5, 5, 4, 4] },
];

export function getPresetById(id: string): RankedPreset | undefined {
  return RANKED_PRESETS.find((p) => p.id === id);
}

export function formatPlacementLabel(position: number): string {
  const suffix = ((): string => {
    if (position % 100 >= 11 && position % 100 <= 13) return "th";
    switch (position % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  })();
  return `${position}${suffix}`;
}

/** Canonical share/publish primitives */
export const MAX_PRIZE_POOL = 1_000_000_000;
export const PERCENTAGE_DECIMALS = 2;

/** Locale per currency — used by formatMoney */
export const CURRENCY_LOCALES: Record<Currency, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
};

/** Publish context — optional header for all formatters/exports */
export interface PrizePublishContext {
  tournamentName?: string;
  date?: string;
  sponsorName?: string;
}

/** Share state version */
export const SHARE_VERSION = 1;

export interface PrizeShareState {
  v: number;
  pool: number;
  cur: Currency;
  method: DistributionMethod;
  placements: PlacementInput[];
  equalCount?: number;
  ctx?: PrizePublishContext;
}

/**
 * Intentional MVP defaults — RCCF-TOOL-02A spec alignment.
 * Default method is Percentage (not Ranked) with 50/30/20 on ₹100,000 INR.
 * Ranked presets remain available as convenience.
 */
export const DEFAULT_PLACEMENTS: PlacementInput[] = [
  { label: "1st", percentage: 50 },
  { label: "2nd", percentage: 30 },
  { label: "3rd", percentage: 20 },
];
export const DEFAULT_METHOD: DistributionMethod = "percentage";
export const DEFAULT_PRIZE_POOL = 100000;
export const DEFAULT_CURRENCY: Currency = "INR";
