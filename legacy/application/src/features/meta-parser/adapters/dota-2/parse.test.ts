import { describe, expect, it } from "vitest";
import { CHECKED_IN_ALIASES } from "./hero-aliases";
import { parseDotaPatchBlock, withEntityNormalized } from "./parse";
import historyFixture from "./fixtures/patchnotes-history.json";
import patch741Fixture from "./fixtures/patchnotes-7-41.json";

const ALIAS_MAP = CHECKED_IN_ALIASES;

describe("dota patch-block parser", () => {
  it("parses general changes with numeric transitions", () => {
    const block = (patch741Fixture as Record<string, unknown>)["7_41"] as never;
    const changes = parseDotaPatchBlock({ block, upstreamCommit: null, aliasMap: ALIAS_MAP });
    const bounty = changes.find((change) => change.description.includes("Flagbearer Creep Experience Bounty"));
    expect(bounty).toMatchObject({
      entityType: "system",
      category: "system",
      oldText: "57",
      newText: "60",
      changeType: "buff",
    });
    const reflect = changes.find((change) => change.description.includes("Reflect Base damage reflection"));
    expect(reflect).toMatchObject({ changeType: "nerf" });
  });

  it("marks prose-only entries as adjustment/low instead of guessing", () => {
    const block = (patch741Fixture as Record<string, unknown>)["7_41"] as never;
    const changes = parseDotaPatchBlock({ block, upstreamCommit: null, aliasMap: ALIAS_MAP });
    const facets = changes.find((change) => change.description === "Facets removed from the game");
    expect(facets).toMatchObject({ changeType: "neutral" });
    const meeting = changes.find((change) => change.description.includes("meeting point of the lane creeps"));
    expect(meeting).toMatchObject({ changeType: "adjustment", confidence: "low" });
  });

  it("parses item, hero ability, and talent changes", () => {
    const block = (historyFixture as Record<string, unknown>)["7_06d"] as never;
    const changes = parseDotaPatchBlock({ block, upstreamCommit: "abc123", aliasMap: ALIAS_MAP });
    const necro = changes.find((change) => change.entityKey === "necronomicon");
    expect(necro).toMatchObject({ entityType: "item", entityName: "Necronomicon", changeType: "buff" });
    const hookshot = changes.find((change) => change.description.includes("Hookshot damage reduced"));
    expect(hookshot).toMatchObject({
      entityType: "hero",
      entityName: "Clockwerk",
      category: "ability",
      changeType: "nerf",
    });
    expect(hookshot?.metadata["hero_key"]).toBe("rattletrap");
    expect(hookshot?.metadata["ability_key"]).toBe("rattletrap_hookshot");
    expect(hookshot?.metadata["upstream_commit"]).toBe("abc123");
    const talents = changes.filter((change) => change.category === "talents");
    expect(talents.length).toBeGreaterThanOrEqual(2);
  });

  it("parses OLD/NEW formulas as text with null numerics", () => {
    const block = (historyFixture as Record<string, unknown>)["7_40"] as never;
    const changes = parseDotaPatchBlock({ block, upstreamCommit: null, aliasMap: ALIAS_MAP });
    const formula = changes.find((change) => change.description.includes("VictimNetworth"));
    expect(formula).toBeDefined();
    expect(formula?.oldText ?? "").toContain("VictimNetworth");
    expect(formula?.newText ?? "").toContain("50 +");
    expect(formula?.oldNumeric).toBeNull();
    // Captains Mode header + OLD/NEW lines stay plain readable text
    expect(formula?.description).not.toMatch(/<[^>]*>/);
  });

  it("skips markup-only entries and keeps stable keys unique", () => {
    const changes = parseDotaPatchBlock({
      block: { general: ["<br>", "  ", "Real change increased from 1 to 2"] },
      upstreamCommit: null,
      aliasMap: ALIAS_MAP,
    });
    expect(changes).toHaveLength(1);
    const keys = changes.map((change) => change.stableKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("withEntityNormalized resolves canonical hero names", () => {
    const block = (historyFixture as Record<string, unknown>)["7_06d"] as never;
    const changes = withEntityNormalized(
      parseDotaPatchBlock({ block, upstreamCommit: null, aliasMap: ALIAS_MAP })
    );
    const clockwerk = changes.find((change) => change.entityKey === "rattletrap");
    expect(clockwerk?.entityNormalized).toBe("clockwerk");
  });
});
