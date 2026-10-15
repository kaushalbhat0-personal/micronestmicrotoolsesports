import { describe, expect, it } from "vitest";
import {
  extractLoLTransition,
  leadingNumber,
  normalizeArrows,
  parseLoLArticle,
  trailingNumber,
} from "./parse";

const ALIAS_MAP = new Map<string, string>();

/** Minimal Rift block: ## Champions → ### Ashe → #### ability → rows. */
function block(rows: string[], ability = "Q - Test Ability"): { lines: Array<{ depth: number; text: string; heading?: boolean; quote?: boolean; level?: number }> } {
  return {
    lines: [
      { depth: 0, text: "Champions", heading: true, level: 2 },
      { depth: 0, text: "Ashe", heading: true, level: 3 },
      { depth: 0, text: ability, heading: true, level: 4 },
      ...rows.map((text) => ({ depth: 0, text })),
    ],
  };
}

function firstRow(rows: string[], ability = "Q - Test Ability") {
  const changes = parseLoLArticle({ block: block(rows, ability), upstreamCommit: null, aliasMap: ALIAS_MAP });
  return changes[0];
}

describe("lol numeric transitions", () => {
  it("supports the ⇒ delimiter plus → and -> alternates", () => {
    expect(extractLoLTransition("Damage: 20 ⇒ 10")).toMatchObject({ oldText: "20", newText: "10" });
    expect(extractLoLTransition("Damage: 20 → 10")).toMatchObject({ oldText: "20", newText: "10" });
    expect(extractLoLTransition("Damage: 20 -> 10")).toMatchObject({ oldText: "20", newText: "10" });
    expect(extractLoLTransition("Damage: 20")).toBeNull();
  });

  it("normalizes named arrow entities", () => {
    expect(normalizeArrows("A &rArr; B")).toBe("A ⇒ B");
    expect(normalizeArrows("A &#8658; B")).toBe("A ⇒ B");
  });

  it("scalar row classifies nerf with scalar numerics", () => {
    const row = firstRow(["Attack Damage: 62 ⇒ 64"]);
    expect(row).toMatchObject({
      entityName: "Ashe",
      oldNumeric: 62,
      newNumeric: 64,
      unit: null,
      changeType: "buff",
      confidence: "medium",
    });
  });

  it("percent row preserves unit and direction", () => {
    const row = firstRow(["Shield Bonus Health Ratio: 11% ⇒ 14%"]);
    expect(row).toMatchObject({ oldNumeric: 11, newNumeric: 14, unit: "%", changeType: "buff" });
  });

  it("slash list keeps full texts with null numerics and first-component direction", () => {
    const row = firstRow(["Mana Cost: 46 / 42 / 38 / 34 / 30 ⇒ 30"]);
    expect(row).toMatchObject({
      oldText: "46 / 42 / 38 / 34 / 30",
      newText: "30",
      oldNumeric: null,
      newNumeric: 30,
      changeType: "buff",
    });
  });

  it("range row compares endpoints without manufacturing magnitudes", () => {
    const row = firstRow(["Damage: 5 - 30 ⇒ 5 - 25"]);
    expect(row).toMatchObject({
      oldText: "5 - 30",
      newText: "5 - 25",
      oldNumeric: null,
      newNumeric: null,
      changeType: "nerf",
    });
  });

  it("per-level growth compares base then growth", () => {
    const row = firstRow(["Attack Damage: 60 + 2.5/Level ⇒ 60 + 2.9/Level"]);
    expect(row).toMatchObject({ oldNumeric: null, newNumeric: null, changeType: "buff" });
  });

  it("formula rows keep full texts with null numerics", () => {
    const row = firstRow(["Cone Damage: 140 / 250 / 360 + 120% bonus AD ⇒ 140 / 230 / 320 + 100% bonus AD"]);
    expect(row).toMatchObject({ oldNumeric: null, newNumeric: null, changeType: "nerf" });
  });

  it("conflicting multi-stat components fall back to adjustment/low", () => {
    const row = firstRow(["Attack Damage: 63 + 3.5/Level ⇒ 61 + 3.9/Level"]);
    expect(row).toMatchObject({ changeType: "adjustment", confidence: "low" });
  });

  it("zero is preserved as numeric 0, never null", () => {
    const row = firstRow(["Tenacity: 0 ⇒ 20"]);
    expect(row?.oldNumeric).toBe(0);
    expect(row).toMatchObject({ newNumeric: 20, changeType: "buff" });
  });

  it("qualitative rows keep null numerics with adjustment/low", () => {
    const row = firstRow(["Damage Timing: Starts dealing damage immediately ⇒ Starts dealing damage 0.25s into the animation"]);
    expect(row).toMatchObject({ oldNumeric: null, newNumeric: null, changeType: "adjustment", confidence: "low" });
  });

  it("removal-worded qualitative rows take the shared neutral path", () => {
    const row = firstRow(["Slow Stacking: Stacks with other slows ⇒ No longer stacks with other slows"]);
    expect(row).toMatchObject({ oldNumeric: null, newNumeric: null, changeType: "neutral", confidence: "medium" });
  });

  it("seconds suffix is normalized to unit s", () => {
    const row = firstRow(["Cooldown: 140 / 115 / 90 seconds ⇒ 160 / 130 / 100 seconds"]);
    expect(row).toMatchObject({ unit: "s", changeType: "nerf" });
  });
});

describe("lol direction classification", () => {
  it("damage_taken decrease is a buff (override inversion)", () => {
    const row = firstRow(["Damage Taken: 105% ⇒ 100%"]);
    expect(row).toMatchObject({ oldNumeric: 105, newNumeric: 100, unit: "%", changeType: "buff", confidence: "medium" });
  });

  it("cooldown decrease is a buff via shared up-bad polarity", () => {
    const row = firstRow(["Cooldown: 20 / 18 / 16 / 14 / 12 seconds ⇒ 18 / 16.5 / 15 / 13.5 / 12 seconds"]);
    expect(row).toMatchObject({ changeType: "buff" });
  });

  it("unknown attributes fall back to adjustment/low without guessing", () => {
    const row = firstRow(["Monster Mod: 150% ⇒ 165%"]);
    expect(row).toMatchObject({ changeType: "adjustment", confidence: "low" });
  });

  it("scoped TL;DR buff wording upgrades only hinted adjustment/low rows", () => {
    const intro = {
      lines: [
        { depth: 0, text: "Patch intro", heading: true, level: 1 },
        { depth: 0, text: "We are giving buffs to Shroud abilities like Twilight Shroud this patch.", quote: true },
        { depth: 0, text: "Champions", heading: true, level: 2 },
        { depth: 0, text: "Akali", heading: true, level: 3 },
        { depth: 0, text: "Twilight Shroud", heading: true, level: 4 },
        { depth: 0, text: "Cast Range: 500 ⇒ 500, now reveals targets" },
        { depth: 0, text: "Zed", heading: true, level: 3 },
        { depth: 0, text: "Living Shadow", heading: true, level: 4 },
        { depth: 0, text: "Cast Range: 500 ⇒ 500, now reveals targets" },
      ],
    };
    const changes = parseLoLArticle({ block: intro, upstreamCommit: null, aliasMap: ALIAS_MAP });
    const hinted = changes.find((change) => change.entityName === "Akali");
    const control = changes.find((change) => change.entityName === "Zed");
    expect(hinted).toMatchObject({ changeType: "buff", confidence: "low" });
    expect(hinted?.metadata["tldr_hint"]).toBe(true);
    expect(control).toMatchObject({ changeType: "adjustment", confidence: "low" });
  });

  it("leading/trailing number helpers behave deterministically", () => {
    expect(leadingNumber("46 / 42 / 38")).toBe(46);
    expect(leadingNumber("no numbers here")).toBeNull();
    expect(leadingNumber("−1 second")).toBe(-1);
    expect(trailingNumber("60 + 2.5/Level")).toBe(2.5);
    expect(trailingNumber("no numbers here")).toBeNull();
  });
});
