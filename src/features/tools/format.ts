// P5 tools — display-only currency formatting (local to tools).
// Feature isolation: tools never import feature/tournaments internals, so
// the small Intl wrapper lives here. No arithmetic lives here; the engine
// works in integer minor units and this module only renders them.

import type { ToolCurrency } from "./prize-pool/schema";
import { ordinalLabel, type PrizeDistribution } from "./prize-pool/distribution";

const LOCALE: Record<ToolCurrency, string> = {
  INR: "en-IN",
  USD: "en-US",
};

export function formatToolMoney(amountMinor: number, currency: ToolCurrency): string {
  try {
    return new Intl.NumberFormat(LOCALE[currency], {
      style: "currency",
      currency,
      maximumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

/** Copyable plain-text breakdown. No links, no markup, no claims. */
export function buildResultSummary(distribution: PrizeDistribution, toolName: string): string {
  const lines = distribution.shares.map(
    (share) =>
      `${ordinalLabel(share.position)} — ${formatToolMoney(share.amountMinor, distribution.currency)}`,
  );
  return [
    `${toolName} — calculated breakdown (planning only, not a payment)`,
    `Total: ${formatToolMoney(distribution.totalMinor, distribution.currency)}`,
    ...lines,
    `Distributed: ${formatToolMoney(distribution.distributedMinor, distribution.currency)}`,
    `Unallocated: ${formatToolMoney(distribution.unallocatedMinor, distribution.currency)}`,
  ].join("\n");
}
