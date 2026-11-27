// P3 tournaments domain — fee and prize representation.
// Amounts are minor units (paise/cents) as non-negative integers with an
// ISO-4217 currency code. Null means "not disclosed" — the presentation
// layer renders that literally and never invents a figure. Zero fee renders
// as "Free entry". Formatting is display-only; no arithmetic lives here.

export const MAX_MONEY_MINOR = 1_000_000_000_000;

export interface MoneyAmount {
  readonly amountMinor: number;
  readonly currency: string;
}

export function isMoneyAmount(value: unknown): value is MoneyAmount {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record["amountMinor"] === "number" &&
    Number.isInteger(record["amountMinor"]) &&
    (record["amountMinor"] as number) >= 0 &&
    (record["amountMinor"] as number) <= MAX_MONEY_MINOR &&
    typeof record["currency"] === "string" &&
    /^[A-Z]{3}$/.test(record["currency"] as string)
  );
}

export function formatMoney(amount: MoneyAmount): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: amount.currency,
      maximumFractionDigits: amount.amountMinor % 100 === 0 ? 0 : 2,
    }).format(amount.amountMinor / 100);
  } catch {
    return `${amount.currency} ${(amount.amountMinor / 100).toFixed(2)}`;
  }
}

export function formatEntryFee(fee: MoneyAmount | null): string {
  if (fee === null) {
    return "Not disclosed";
  }
  if (fee.amountMinor === 0) {
    return "Free entry";
  }
  return formatMoney(fee);
}

export function formatPrizePool(prize: MoneyAmount | null): string {
  if (prize === null) {
    return "Not disclosed";
  }
  return formatMoney(prize);
}
