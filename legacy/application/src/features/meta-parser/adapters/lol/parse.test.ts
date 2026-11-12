import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { htmlToLines } from "./html";
import { parseLoLArticle } from "./parse";

function article(name: string): { lines: Array<{ depth: number; text: string; heading?: boolean; quote?: boolean }> } {
  const html = readFileSync(
    join(process.cwd(), "src/features/meta-parser/adapters/lol/fixtures", name),
    "utf8"
  );
  return { lines: htmlToLines(html) };
}

const ALIAS_MAP = new Map<string, string>();

describe("lol 26.20 champion changes", () => {
  it("parses Ashe base-stat nerf with scalar numerics", () => {
    const changes = parseLoLArticle({ block: article("patch-26-20.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const row = changes.find((change) => change.description.includes("Attack Damage per Level"));
    expect(row).toMatchObject({
      entityType: "champion",
      entityName: "Ashe",
      category: "Base Stats",
      oldText: "3.5",
      newText: "3",
      oldNumeric: 3.5,
      newNumeric: 3,
      changeType: "nerf",
    });
  });

  it("parses Diana shield buff with percent unit", () => {
    const changes = parseLoLArticle({ block: article("patch-26-20.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const row = changes.find((change) => change.description.includes("Shield Bonus Health Ratio"));
    expect(row).toMatchObject({
      entityType: "champion",
      entityName: "Diana",
      category: "W - Pale Cascade",
      oldNumeric: 11,
      newNumeric: 14,
      unit: "%",
      changeType: "buff",
    });
  });

  it("parses Vayne mana-list collapse and preserves zero-free scalars", () => {
    const changes = parseLoLArticle({ block: article("patch-26-20.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const row = changes.find((change) => change.description.includes("Mana Cost"));
    expect(row).toMatchObject({
      entityType: "champion",
      entityName: "Vayne",
      oldText: "46 / 42 / 38 / 34 / 30",
      newText: "30",
      newNumeric: 30,
      changeType: "buff",
    });
  });

  it("parses K'Sante mana nerf via shared up-bad polarity", () => {
    const changes = parseLoLArticle({ block: article("patch-26-20.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const row = changes.find((change) => change.description.includes("Mana Cost") && change.entityName === "K'Sante");
    expect(row).toMatchObject({ changeType: "nerf", confidence: "medium" });
  });

  it("routes removal-worded qualitative rows through the shared neutral path", () => {
    const changes = parseLoLArticle({ block: article("patch-26-20.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const row = changes.find((change) => change.description.includes("Small Monster Targeting"));
    expect(row).toMatchObject({
      entityType: "champion",
      entityName: "Kindred",
      oldText: "Enabled",
      newText: "Removed",
      oldNumeric: null,
      newNumeric: null,
      changeType: "neutral",
      confidence: "medium",
    });
  });

  it("classifies inline Bug Fix rows as bugfix/high", () => {
    const changes = parseLoLArticle({ block: article("patch-26-20.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const row = changes.find((change) => change.description.includes("critting for too much damage"));
    expect(row).toMatchObject({
      entityType: "champion",
      entityName: "Nautilus",
      changeType: "bugfix",
      confidence: "high",
    });
  });
});

describe("lol 26.20 items, systems, and exclusions", () => {
  it("parses item buff and nerf rows with item entities", () => {
    const changes = parseLoLArticle({ block: article("patch-26-20.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const haste = changes.find((change) => change.description.includes("Ability Haste"));
    expect(haste).toMatchObject({ entityType: "item", entityName: "Hextech Rocketbelt", changeType: "nerf" });
    const active = changes.find((change) => change.description.includes("Active Damage"));
    expect(active).toMatchObject({ entityType: "item", entityName: "Hextech Rocketbelt", changeType: "buff" });
  });

  it("skips Scoreboard Cleanup prose and item-name lists", () => {
    const changes = parseLoLArticle({ block: article("patch-26-20.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    expect(changes.some((change) => change.description.includes("Death's Dance"))).toBe(false);
    expect(changes.some((change) => change.description.includes("scoreboard"))).toBe(false);
  });

  it("classifies global bugfix rows as bugfix/high under General", () => {
    const changes = parseLoLArticle({ block: article("patch-26-20.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const row = changes.find((change) => change.description.includes("Orianna"));
    expect(row).toMatchObject({
      entityType: "system",
      entityName: "General",
      category: "bugfix",
      changeType: "bugfix",
      confidence: "high",
    });
  });

  it("excludes skins, highlights, and related articles", () => {
    const changes = parseLoLArticle({ block: article("patch-26-20.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    expect(changes.some((change) => change.description.includes("HEARTSTEEL"))).toBe(false);
    expect(changes.some((change) => change.entityName.includes("Sett"))).toBe(false);
    expect(changes.some((change) => change.description.includes("will be available"))).toBe(false);
  });
});

describe("lol 26.19 systems, groups, and edge rows", () => {
  it("parses system feature rows as system entities", () => {
    const changes = parseLoLArticle({ block: article("patch-26-19.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const row = changes.find((change) => change.description.includes("Free Teleport Cooldown"));
    expect(row).toMatchObject({
      entityType: "system",
      entityName: "Teleport Cooldown",
      oldNumeric: 420,
      newNumeric: 390,
      unit: "s",
      changeType: "buff",
    });
  });

  it("keeps explicit Unchanged rows factual without manufacturing numerics", () => {
    const changes = parseLoLArticle({ block: article("patch-26-19.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const row = changes.find((change) => change.description.includes("Non-Top Unleashed"));
    expect(row).toMatchObject({
      entityType: "system",
      newText: "Unchanged",
      newNumeric: null,
      changeType: "adjustment",
    });
  });

  it("treats composite item groups as one deterministic item entity", () => {
    const changes = parseLoLArticle({ block: article("patch-26-19.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const row = changes.find((change) => change.description.includes("Health Regeneration"));
    expect(row).toMatchObject({
      entityType: "item",
      entityName: "World Atlas and Runic Compass",
      changeType: "buff",
    });
  });

  it("flags genuinely contradictory multi-stat rows as adjustment/low", () => {
    const changes = parseLoLArticle({ block: article("patch-26-19.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const row = changes.find((change) => change.description.includes("63 + 3.5/Level"));
    expect(row).toMatchObject({ entityName: "Vi", changeType: "adjustment", confidence: "low" });
  });

  it("skips prose-only Unchanged rows without transitions", () => {
    const changes = parseLoLArticle({ block: article("patch-26-19.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    expect(changes.some((change) => change.description.includes("Projectile Damage"))).toBe(false);
  });
});

describe("lol stable keys", () => {
  it("is deterministic across repeated parses", () => {
    const first = parseLoLArticle({ block: article("patch-26-20.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const second = parseLoLArticle({ block: article("patch-26-20.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    expect(second.map((change) => change.stableKey)).toEqual(first.map((change) => change.stableKey));
  });

  it("separates entities, categories, attributes, and repeated occurrences", () => {
    const changes = parseLoLArticle({ block: article("patch-26-20.html"), upstreamCommit: null, aliasMap: ALIAS_MAP });
    const keys = changes.map((change) => change.stableKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key.startsWith("lol:")).toBe(true);
    }
  });

  it("returns [] for non-object blocks without throwing", () => {
    expect(parseLoLArticle({ block: null, upstreamCommit: null, aliasMap: ALIAS_MAP })).toEqual([]);
    expect(parseLoLArticle({ block: "just a string", upstreamCommit: null, aliasMap: ALIAS_MAP })).toEqual([]);
  });
});
