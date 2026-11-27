import { describe, expect, it } from "vitest";
import { classifyChange, compareLevelValues, resolvePolarity } from "./direction-map";

describe("direction map classification", () => {
  it("damage increase → buff", () => {
    expect(classifyChange({ attribute: "damage", direction: 1 })).toMatchObject({ changeType: "buff" });
  });

  it("damage decrease → nerf", () => {
    expect(classifyChange({ attribute: "Shrapnel Damage", direction: -1 })).toMatchObject({ changeType: "nerf" });
  });

  it("cooldown decrease → buff (up-bad polarity)", () => {
    expect(classifyChange({ attribute: "cooldown", direction: -1 })).toMatchObject({ changeType: "buff" });
  });

  it("cooldown increase → nerf", () => {
    expect(classifyChange({ attribute: "manacost", direction: 1 })).toMatchObject({ changeType: "nerf" });
  });

  it("armor increase → buff", () => {
    expect(classifyChange({ attribute: "base armor", direction: 1 })).toMatchObject({ changeType: "buff" });
  });

  it("unknown attribute → adjustment/low (never guessed)", () => {
    expect(classifyChange({ attribute: "meeting point of lane creeps", direction: 1 })).toEqual({
      changeType: "adjustment",
      confidence: "low",
    });
    expect(classifyChange({ attribute: null, direction: 1 })).toEqual({
      changeType: "adjustment",
      confidence: "low",
    });
  });

  it("contradictory multi-effect → adjustment/low", () => {
    expect(classifyChange({ attribute: "damage", direction: 1, contradictory: true })).toEqual({
      changeType: "adjustment",
      confidence: "low",
    });
  });

  it("content flags map directly", () => {
    expect(classifyChange({ attribute: null, direction: 0, isNew: true }).changeType).toBe("new");
    expect(classifyChange({ attribute: null, direction: 0, isRework: true }).changeType).toBe("rework");
    expect(classifyChange({ attribute: null, direction: 0, isBugfix: true }).changeType).toBe("bugfix");
  });

  it("dota override: base attack time down → buff", () => {
    expect(resolvePolarity("Base Attack Time", "dota-2")).toBe("up-bad");
    expect(classifyChange({ attribute: "Base Attack Time", direction: -1, adapterKey: "dota-2" })).toMatchObject({
      changeType: "buff",
    });
  });

  it("compareLevelValues compares first components", () => {
    expect(compareLevelValues("30/40/60", "40/50/60")).toBe(1);
    expect(compareLevelValues("100/200/300", "75/175/275")).toBe(-1);
    expect(compareLevelValues("20/25/30", "20/25/30")).toBe(0);
    expect(compareLevelValues("no numbers", "also none")).toBe(0);
  });
});
