/**
 * Prize Payout Tracker — domain types.
 *
 * Money follows Prize Pool Splitter conventions (integer minor units,
 * INR/USD/EUR/GBP with 2 decimals) without importing that feature's
 * internals — feature isolation forbids cross-feature imports, so the
 * ~15 lines of currency metadata live here once.
 */

export type PayoutCurrency = "INR" | "USD" | "EUR" | "GBP";

export interface PayoutCurrencyConfig {
  code: PayoutCurrency;
  symbol: string;
  label: string;
  locale: string;
}

export const PAYOUT_CURRENCIES: Record<PayoutCurrency, PayoutCurrencyConfig> = {
  INR: { code: "INR", symbol: "₹", label: "Indian Rupee", locale: "en-IN" },
  USD: { code: "USD", symbol: "$", label: "US Dollar", locale: "en-US" },
  EUR: { code: "EUR", symbol: "€", label: "Euro", locale: "de-DE" },
  GBP: { code: "GBP", symbol: "£", label: "British Pound", locale: "en-GB" },
};

export type PayoutTrackerStatus = "draft" | "published" | "completed";

export type PayoutRecipientStatus = "pending" | "paid";

export interface PayoutTrackerRow {
  id: string;
  organization_id: string;
  created_by: string;
  event_name: string;
  currency: PayoutCurrency;
  deadline: string | null;
  status: PayoutTrackerStatus;
  share_token: string;
  published_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayoutRecipientRow {
  id: string;
  tracker_id: string;
  recipient_name: string;
  amount_minor: number;
  status: PayoutRecipientStatus;
  paid_at: string | null;
  reference_last4: string | null;
  proof_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Largest single-recipient amount in major units (mirrors splitter pool cap). */
export const MAX_RECIPIENT_AMOUNT_MAJOR = 1_000_000_000;

/** Minor units per major unit — all supported currencies use 2 decimals. */
export const PAYOUT_MINOR_FACTOR = 100;
