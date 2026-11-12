import { describe, expect, it } from "vitest";
import type { SplitResult } from "../types";
import { buildSplitterWhatsAppMessage } from "./whatsapp";

function result(placements: number): SplitResult {
  return {
    prizePool: 10000,
    prizePoolMinor: 1000000,
    currency: "INR",
    method: "percentage",
    placements: Array.from({ length: placements }, (_, i) => ({
      position: i + 1,
      label: `Team ${i + 1}`,
      percentage: Math.round((100 / placements) * 100) / 100,
      payout: Math.round((10000 / placements) * 100) / 100,
      payoutMinor: Math.round(1000000 / placements),
      remainderDistributed: 0,
    })),
    totalPercentage: 100,
    totalDistributed: 10000,
    totalDistributedMinor: 1000000,
    remaining: 0,
    remainingMinor: 0,
    isBalanced: true,
  };
}

describe("buildSplitterWhatsAppMessage", () => {
  it("contains the existing result and the share URL on the last line", () => {
    const msg = buildSplitterWhatsAppMessage(result(3), { tournamentName: "City Cup" }, "https://example.com/share/prize-splitter?s=abc");
    expect(msg).toContain("Prize Pool:");
    expect(msg).toContain("Team 1");
    expect(msg).toContain("Total Distributed:");
    expect(msg).toContain("City Cup");
    const lines = msg.split("\n");
    expect(lines[lines.length - 1]).toBe("View online: https://example.com/share/prize-splitter?s=abc");
    expect(lines[lines.length - 2]).toBe("");
  });

  it("bounds long placement lists with an explicit marker, keeping totals and URL", () => {
    const msg = buildSplitterWhatsAppMessage(result(60), undefined, "https://example.com/share/x?s=abc", 500);
    expect(msg.length).toBeLessThanOrEqual(500);
    expect(msg).toMatch(/…and \d+ more placements \(full split at the link\)\./);
    expect(msg).toContain("Total Distributed:");
    expect(msg.endsWith("View online: https://example.com/share/x?s=abc")).toBe(true);
  });

  it("invents no values: every amount comes from the result", () => {
    const msg = buildSplitterWhatsAppMessage(result(2), undefined, "https://example.com/s");
    expect(msg).not.toContain("Team 3");
    expect(msg).toContain("Team 2");
  });
});
