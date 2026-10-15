import { describe, expect, it } from "vitest";
import { extractTransition } from "./numeric-extract";

describe("extractTransition", () => {
  it("extracts integer transitions", () => {
    const t = extractTransition("Chemical Rage movement speed increased from 30/40/60 to 40/50/60");
    expect(t.oldText).toBe("30/40/60");
    expect(t.newText).toBe("40/50/60");
    expect(t.scalar).toBe(false);
    expect(t.oldNumeric).toBeNull();
  });

  it("extracts scalar decimals and percentages", () => {
    const t = extractTransition("Cooldown reduced from 100/85/70 to 90/80/70");
    expect(t.oldText).toBe("100/85/70");
    const scalar = extractTransition("Base armor increased by 1");
    expect(scalar.oldText).toBeNull();
    const pct = extractTransition("Damage reduction increased from 35% to 40%");
    expect(pct.oldNumeric).toBe(35);
    expect(pct.newNumeric).toBe(40);
    expect(pct.scalar).toBe(true);
  });

  it("extracts seconds values", () => {
    const t = extractTransition("Doom duration increased from 15 to 16 seconds");
    expect(t.oldNumeric).toBe(15);
    expect(t.newNumeric).toBe(16);
  });

  it("preserves OLD/NEW formulas as text without scalar numerics", () => {
    const t = extractTransition(
      "Assist Gold Formula Reworked OLD: 60 + ( ( VictimNetworth * 0.037 ) / NumHeroes ) NEW: 15 + ( ( 50 + ( VictimNetworth * 0.037 ) ) / NumHeroes )"
    );
    expect(t.oldText).toContain("VictimNetworth");
    expect(t.newText).toContain("50 +");
    expect(t.scalar).toBe(false);
    expect(t.oldNumeric).toBeNull();
    expect(t.newNumeric).toBeNull();
  });

  it("returns empty transition when no endpoints exist", () => {
    expect(extractTransition("Facets removed from the game")).toEqual({
      oldText: null,
      newText: null,
      oldNumeric: null,
      newNumeric: null,
      scalar: false,
    });
    expect(extractTransition("")).toEqual({
      oldText: null,
      newText: null,
      oldNumeric: null,
      newNumeric: null,
      scalar: false,
    });
  });
});
