import { describe, it, expect } from "vitest";
import { calculateSplit } from "./calculation";
import { buildCsv } from "./export";

describe("buildCsv", () => {
  it("header and raw numeric values", () => {
    const r = calculateSplit({ prizePool: 100000, currency: "INR", method: "percentage", placements: [{ label: "1st", percentage: 50 }, { label: "2nd", percentage: 30 }, { label: "3rd", percentage: 20 }] });
    const csv = buildCsv(r, undefined);
    expect(csv).toContain("Position,Label,Percentage,Payout,PayoutMinor");
    expect(csv).toContain("1,1st,50,50000,5000000");
    expect(csv).toContain("2,2nd,30,30000,3000000");
    expect(csv).toContain("3,3rd,20,20000,2000000");
    // no locale commas in numeric
    expect(csv).not.toContain("₹");
    expect(csv).not.toContain("1,00,000");
  });

  it("metadata included when context supplied", () => {
    const r = calculateSplit({ prizePool: 50000, currency: "USD", method: "percentage", placements: [{ label: "1st", percentage: 100 }] });
    const csv = buildCsv(r, { tournamentName: "Cup", date: "2026-10-20", sponsorName: "Acme" });
    expect(csv).toContain("Tournament,Cup");
    expect(csv).toContain("Date,2026-10-20");
    expect(csv).toContain("Sponsor,Acme");
    expect(csv).toContain("Prize Pool,50000");
    expect(csv).toContain("Currency,USD");
  });

  it("total rows correct for equal split", () => {
    const r = calculateSplit({ prizePool: 100, currency: "EUR", method: "equal", placements: [], equalCount: 3 });
    const csv = buildCsv(r, undefined);
    // 3 rows
    const lines = csv.split("\n").filter((l) => /^\d+,/.test(l));
    expect(lines.length).toBe(3);
  });

  it("csvEscape handles commas and quotes", () => {
    const r = calculateSplit({ prizePool: 1000, currency: "GBP", method: "percentage", placements: [{ label: "1st", percentage: 100 }] });
    const csv = buildCsv(r, { tournamentName: 'Cup, "Special"' });
    expect(csv).toContain('"Cup, ""Special"""');
  });
});
