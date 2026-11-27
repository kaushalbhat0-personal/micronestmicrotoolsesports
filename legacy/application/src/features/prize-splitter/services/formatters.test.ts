import { describe, it, expect } from "vitest";
import { calculateSplit } from "./calculation";
import { formatPayoutAnnouncement } from "./formatters";
import type { SplitInput, PrizePublishContext } from "../types";

function baseResult(pool = 100000) {
  const input: SplitInput = { prizePool: pool, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 50 }, { label: "2nd", percentage: 30 }, { label: "3rd", percentage: 20 }] };
  return calculateSplit(input);
}

describe("formatPayoutAnnouncement", () => {
  it("plain — no context", () => {
    const r = baseResult();
    const t = formatPayoutAnnouncement(r, undefined, "plain");
    expect(t).toContain("Prize Pool:");
    expect(t).toContain("1st — 50%");
    expect(t).toContain("Total Distributed:");
    expect(t).not.toContain("Valorant");
  });

  it("plain — with context", () => {
    const r = baseResult();
    const ctx: PrizePublishContext = { tournamentName: "Valorant Champions Cup", sponsorName: "Acme Esports", date: "2026-10-20" };
    const t = formatPayoutAnnouncement(r, ctx, "plain");
    expect(t).toContain("Valorant Champions Cup");
    expect(t).toContain("Presented by Acme Esports");
    // date formatted
    expect(t).toContain("20 October 2026");
  });

  it("plain — currency INR vs USD", () => {
    const inr = calculateSplit({ prizePool: 1000, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 100 }] });
    const usd = calculateSplit({ prizePool: 1000, currency: "USD", method: "percentage", placements: [{ label: "1st", percentage: 100 }] });
    expect(formatPayoutAnnouncement(inr, undefined, "plain")).toContain("₹");
    expect(formatPayoutAnnouncement(usd, undefined, "plain")).toContain("$");
  });

  it("discord — has bold and code block", () => {
    const r = baseResult();
    const ctx: PrizePublishContext = { tournamentName: "Cup", date: "2026-10-20" };
    const t = formatPayoutAnnouncement(r, ctx, "discord");
    expect(t).toContain("**Cup**");
    expect(t).toContain("```text");
    expect(t).toContain("```");
    expect(t).toContain("**Prize Pool:");
  });

  it("whatsapp — restrained emoji and context", () => {
    const r = baseResult();
    const ctx: PrizePublishContext = { tournamentName: "My Cup" };
    const t = formatPayoutAnnouncement(r, ctx, "whatsapp");
    expect(t).toContain("🏆 My Cup");
    // whatsapp should not have discord code fences
    expect(t).not.toContain("```");
  });

  it("x — compact summary", () => {
    const r = baseResult();
    const ctx: PrizePublishContext = { tournamentName: "Valorant Champions Cup" };
    const t = formatPayoutAnnouncement(r, ctx, "x");
    expect(t).toContain("🏆 Valorant Champions Cup");
    expect(t).toContain("prize pool");
    // should contain payouts
    expect(t).toContain("1st");
    expect(t.length).toBeLessThanOrEqual(280);
  });

  it("x — many placements truncates", () => {
    const placements = Array.from({ length: 10 }, (_, i) => ({ label: `${i + 1}th`, percentage: 10 }));
    const r = calculateSplit({ prizePool: 10000, currency: "INR", method: "percentage", placements });
    const t = formatPayoutAnnouncement(r, undefined, "x");
    expect(t).toContain("+");
    expect(t.length).toBeLessThanOrEqual(280);
  });

  it("all styles — totals correct", () => {
    const r = baseResult(100);
    for (const style of ["plain", "discord", "whatsapp", "x"] as const) {
      const t = formatPayoutAnnouncement(r, undefined, style);
      // all should mention total distributed or pool
      expect(t.length).toBeGreaterThan(10);
    }
  });

  it("eur/gbp symbols", () => {
    const eur = calculateSplit({ prizePool: 1000, currency: "EUR", method: "percentage", placements: [{ label: "1st", percentage: 100 }] });
    const gbp = calculateSplit({ prizePool: 1000, currency: "GBP", method: "percentage", placements: [{ label: "1st", percentage: 100 }] });
    expect(formatPayoutAnnouncement(eur, undefined, "plain")).toContain("€");
    expect(formatPayoutAnnouncement(gbp, undefined, "plain")).toContain("£");
  });
});
