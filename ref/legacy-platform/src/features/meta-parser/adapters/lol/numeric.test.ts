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

describe("lol trailing fallback conservative rule (lol-html.2)", () => {
  it("abstains on signed range fragments: +0-9% → +0-10.5% (no trailing decision)", () => {
    const transition = extractLoLTransition(
      "Super Scorcher Bonus Magic Damage: 25 - 55% (+0-9% bonus AD) ⇒ 25 - 60% (+0-10.5% bonus AD)"
    );
    expect(transition).not.toBeNull();
    // Leading tokens are equal (25 = 25); the blind trailing comparison
    // would read -9 vs -10.5 (nerf). The conservative rule abstains.
    expect(transition?.direction).toBe(0);
    expect(transition?.contradictory).toBe(false);
  });

  it("abstains on signed range fragments: +0-1.44% → +0-1.8% (no trailing decision)", () => {
    const transition = extractLoLTransition(
      "Flap Flap Flap Bonus Magic Damage: 8 - 12.8% (+0-1.44% bonus AD) ⇒ 8 - 14% (+0-1.8% bonus AD)"
    );
    expect(transition).not.toBeNull();
    expect(transition?.direction).toBe(0);
    expect(transition?.contradictory).toBe(false);
  });

  it("abstains on unequal structures: +45% AP → +45% AP +20% bonus AD (no trailing decision)", () => {
    const transition = extractLoLTransition(
      "Lightning On Hit Damage: 11 - 60 (Levels 1-18) (+45% AP) ⇒ 11 - 60 (Levels 1-18) (+45% AP) (+20% bonus AD)"
    );
    expect(transition).not.toBeNull();
    // Token counts differ (5 vs 6); the blind trailing comparison would
    // read 45 vs 20 (nerf). The conservative rule abstains.
    expect(transition?.direction).toBe(0);
    expect(transition?.contradictory).toBe(false);
  });

  it("downgrades the Lillia unequal-count case to adjustment/low", () => {
    const row = firstRow(["Sleep Duration: 2.5s ⇒ 2.5/2.75/3s"], "E - Swirlseed");
    expect(row).toMatchObject({ changeType: "adjustment", confidence: "low" });
  });

  it("preserves safe trailing comparisons where structures are genuinely aligned", () => {
    // Spaced ranges: the separator carries whitespace, so 30/25 are
    // standalone values, not signed fragments.
    expect(extractLoLTransition("Damage: 5 - 30 ⇒ 5 - 25")?.direction).toBe(-1);
    // Growth comparison on aligned token counts.
    expect(extractLoLTransition("Attack Damage: 60 + 2.5/Level ⇒ 60 + 2.9/Level")?.direction).toBe(1);
    // Multi-component formula rows with equal token counts.
    expect(
      extractLoLTransition("Cone Damage: 140 / 250 / 360 + 120% bonus AD ⇒ 140 / 230 / 320 + 100% bonus AD")
        ?.direction
    ).toBe(-1);
    // Percent rows with equal token counts.
    expect(extractLoLTransition("Shield Bonus Health Ratio: 11% ⇒ 14%")?.direction).toBe(1);
    // Scalar rows (single token each side).
    expect(extractLoLTransition("Attack Damage: 62 ⇒ 64")?.direction).toBe(1);
    expect(extractLoLTransition("Tenacity: 0 ⇒ 20")?.direction).toBe(1);
  });

  it("keeps legitimate negative values comparable (never rejected as ranges)", () => {
    expect(extractLoLTransition("Slow Duration: -5 ⇒ -3")?.direction).toBe(1);
    expect(extractLoLTransition("Haste: −1 second ⇒ −2 seconds")?.direction).toBe(-1);
  });

  it("leaves leading-decided rows unchanged", () => {
    const buff = firstRow(["Attack Damage: 62 ⇒ 64"]);
    expect(buff).toMatchObject({ changeType: "buff", confidence: "medium" });
    const slash = firstRow(["Mana Cost: 46 / 42 / 38 / 34 / 30 ⇒ 30"]);
    expect(slash).toMatchObject({ changeType: "buff" });
    const cooldown = firstRow(["Cooldown: 20 / 18 / 16 / 14 / 12 seconds ⇒ 18 / 16.5 / 15 / 13.5 / 12 seconds"]);
    expect(cooldown).toMatchObject({ changeType: "buff" });
  });

  it("leaves contradictory leading/trailing rows at adjustment/low", () => {
    const row = firstRow(["Attack Damage: 63 + 3.5/Level ⇒ 61 + 3.9/Level"]);
    expect(row).toMatchObject({ changeType: "adjustment", confidence: "low" });
  });

  it("keeps zero comparisons correct", () => {
    const row = firstRow(["Tenacity: 0 ⇒ 20"]);
    expect(row?.oldNumeric).toBe(0);
    expect(row).toMatchObject({ newNumeric: 20, changeType: "buff" });
    expect(extractLoLTransition(" stacks: 0 ⇒ 0")?.direction).toBe(0);
  });

  it("keeps the damage_taken polarity override unchanged", () => {
    const row = firstRow(["Damage Taken: 105% ⇒ 100%"]);
    expect(row).toMatchObject({ oldNumeric: 105, newNumeric: 100, unit: "%", changeType: "buff", confidence: "medium" });
  });
});

describe("lol production reconciliation (audited direction fix)", () => {
  /**
   * Local reproduction of the three production defects plus the accepted
   * Lillia downgrade, using the exact old/new endpoint strings from the
   * audit. Production article HTML is not reproduced here; row-level
   * endpoint strings are sufficient because direction classification is a
   * pure function of (oldText, newText, attribute, hint sentences).
   *
   * Parser-level outcome for all three unsafe rows is adjustment/low (no
   * invented Buff/Nerf). In production the scoped TL;DR buff wording
   * naming the buffed ability upgrades adjustment/low to buff/low through
   * the pre-existing hint path — demonstrated below with hint sentences.
   * Whether live patch intros name each ability determines the final
   * production confidence; that wording is verified at audit time, not
   * invented here.
   */
  function championBlock(
    intro: string[],
    entity: string,
    category: string,
    rows: string[]
  ): { lines: Array<{ depth: number; text: string; heading?: boolean; quote?: boolean; level?: number }> } {
    return {
      lines: [
        { depth: 0, text: "Patch intro", heading: true, level: 1 },
        ...intro.map((text) => ({ depth: 0, text })),
        { depth: 0, text: "Champions", heading: true, level: 2 },
        { depth: 0, text: entity, heading: true, level: 3 },
        { depth: 0, text: category, heading: true, level: 4 },
        ...rows.map((text) => ({ depth: 0, text })),
      ],
    };
  }

  const SMOLDER_SCORCHER_OLD = "25 - 55% (+0-9% bonus AD)";
  const SMOLDER_SCORCHER_NEW = "25 - 60% (+0-10.5% bonus AD)";
  const SMOLDER_FLAP_OLD = "8 - 12.8% (+0-1.44% bonus AD)";
  const SMOLDER_FLAP_NEW = "8 - 14% (+0-1.8% bonus AD)";
  const VOLIBEAR_OLD = "11 - 60 (Levels 1-18) (+45% AP)";
  const VOLIBEAR_NEW = "11 - 60 (Levels 1-18) (+45% AP) (+20% bonus AD)";

  it("Smolder super_scorcher no longer invents nerf (adjustment without hint, buff with scoped hint)", () => {
    const plain = parseLoLArticle({
      block: championBlock(
        [],
        "Smolder",
        "Passive - Dragon Practice",
        [`Super Scorcher Bonus Magic Damage: ${SMOLDER_SCORCHER_OLD} ⇒ ${SMOLDER_SCORCHER_NEW}`]
      ),
      upstreamCommit: null,
      aliasMap: ALIAS_MAP,
    });
    expect(plain).toHaveLength(1);
    expect(plain[0]).toMatchObject({ changeType: "adjustment", confidence: "low" });

    const hinted = parseLoLArticle({
      block: championBlock(
        ["We are giving buffs to Passive - Dragon Practice this patch, including Super Scorcher Bonus Magic Damage."],
        "Smolder",
        "Passive - Dragon Practice",
        [`Super Scorcher Bonus Magic Damage: ${SMOLDER_SCORCHER_OLD} ⇒ ${SMOLDER_SCORCHER_NEW}`]
      ),
      upstreamCommit: null,
      aliasMap: ALIAS_MAP,
    });
    expect(hinted).toHaveLength(1);
    expect(hinted[0]).toMatchObject({ changeType: "buff", confidence: "low" });
    expect(hinted[0]?.metadata["tldr_hint"]).toBe(true);
  });

  it("Smolder flap no longer invents nerf (adjustment without hint, buff with scoped hint)", () => {
    const plain = parseLoLArticle({
      block: championBlock(
        [],
        "Smolder",
        "Passive - Dragon Practice",
        [`Flap Flap Flap Bonus Magic Damage: ${SMOLDER_FLAP_OLD} ⇒ ${SMOLDER_FLAP_NEW}`]
      ),
      upstreamCommit: null,
      aliasMap: ALIAS_MAP,
    });
    expect(plain).toHaveLength(1);
    expect(plain[0]).toMatchObject({ changeType: "adjustment", confidence: "low" });

    const hinted = parseLoLArticle({
      block: championBlock(
        ["We are giving buffs to Passive - Dragon Practice this patch, including Flap Flap Flap Bonus Magic Damage."],
        "Smolder",
        "Passive - Dragon Practice",
        [`Flap Flap Flap Bonus Magic Damage: ${SMOLDER_FLAP_OLD} ⇒ ${SMOLDER_FLAP_NEW}`]
      ),
      upstreamCommit: null,
      aliasMap: ALIAS_MAP,
    });
    expect(hinted).toHaveLength(1);
    expect(hinted[0]).toMatchObject({ changeType: "buff", confidence: "low" });
  });

  it("Volibear lightning no longer invents nerf (adjustment without hint, buff with scoped hint)", () => {
    const plain = parseLoLArticle({
      block: championBlock(
        [],
        "Volibear",
        "Passive - The Relentless Storm",
        [`Lightning On Hit Damage: ${VOLIBEAR_OLD} ⇒ ${VOLIBEAR_NEW}`]
      ),
      upstreamCommit: null,
      aliasMap: ALIAS_MAP,
    });
    expect(plain).toHaveLength(1);
    expect(plain[0]).toMatchObject({ changeType: "adjustment", confidence: "low" });

    const hinted = parseLoLArticle({
      block: championBlock(
        ["We are giving buffs to Passive - The Relentless Storm this patch, including Lightning On Hit Damage."],
        "Volibear",
        "Passive - The Relentless Storm",
        [`Lightning On Hit Damage: ${VOLIBEAR_OLD} ⇒ ${VOLIBEAR_NEW}`]
      ),
      upstreamCommit: null,
      aliasMap: ALIAS_MAP,
    });
    expect(hinted).toHaveLength(1);
    expect(hinted[0]).toMatchObject({ changeType: "buff", confidence: "low" });
  });

  it("Lillia unequal-count row stays adjustment/low even with unrelated buff wording", () => {
    const changes = parseLoLArticle({
      block: championBlock(
        ["We are giving buffs to Smolder this patch."],
        "Lillia",
        "E - Swirlseed",
        ["Sleep Duration: 2.5s ⇒ 2.5/2.75/3s"]
      ),
      upstreamCommit: null,
      aliasMap: ALIAS_MAP,
    });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ changeType: "adjustment", confidence: "low" });
  });
});
