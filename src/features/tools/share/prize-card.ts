import { ordinalLabel, type PrizeDistribution } from "@/features/tools/prize-pool/distribution";
import { formatToolMoney } from "@/features/tools/format";
import type { ShareCardSpec } from "@/lib/share-kit";

export function buildPrizeShareSpec(
  distribution: PrizeDistribution,
  destinationLabel: string,
): ShareCardSpec {
  const rows = [
    {
      label: "Total pool",
      value: formatToolMoney(distribution.totalMinor, distribution.currency),
    },
    {
      label: "Distributed",
      value: formatToolMoney(distribution.distributedMinor, distribution.currency),
    },
  ];
  if (distribution.unallocatedMinor > 0) {
    rows.push({
      label: "Unallocated",
      value: formatToolMoney(distribution.unallocatedMinor, distribution.currency),
    });
  }

  const blocks = distribution.shares.slice(0, 12).map(
    (share) =>
      `${ordinalLabel(share.position)} — ${formatToolMoney(share.amountMinor, distribution.currency)}`,
  );
  if (distribution.shares.length > 12) {
    blocks.push(`+${distribution.shares.length - 12} more positions`);
  }

  return {
    tone: "tool",
    eyebrow: "Prize Pool Splitter",
    title: `${distribution.currency} prize split`,
    subtitle: "User-calculated planning breakdown",
    rows,
    blocks,
    disclaimer:
      "Planning aid only — not a payment, transfer, or escrow. Generated with FRAGIX tools.",
    destinationLabel,
    filenameBase: `prize-pool-${distribution.currency.toLowerCase()}`,
  };
}
