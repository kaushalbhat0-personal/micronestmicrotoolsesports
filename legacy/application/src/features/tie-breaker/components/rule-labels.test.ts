import { describe, expect, it } from "vitest";
import { formatDiff, presetDescription, ruleDescription, ruleLabel, statusLabel } from "./rule-labels";

describe("rule labels", () => {
  it("labels every rule in customer language", () => {
    expect(ruleLabel("points")).toBe("Points");
    expect(ruleLabel("h2h")).toBe("Head-to-head");
    expect(ruleLabel("map_diff")).toBe("Map difference");
    expect(ruleLabel("round_diff")).toBe("Round difference");
    expect(ruleLabel("wins")).toBe("Total wins");
  });

  it("explains head-to-head without jargon", () => {
    expect(ruleDescription("h2h")).toContain("still tied");
  });

  it("describes presets as starting points, never rulebooks", () => {
    expect(presetDescription("swiss_lite")).toContain("never pairs rounds");
  });

  it("uses Draft, Active, and Locked status labels", () => {
    expect(statusLabel("draft")).toBe("Draft");
    expect(statusLabel("active")).toBe("Active");
    expect(statusLabel("locked")).toBe("Locked");
  });

  it("formats differentials with explicit signs", () => {
    expect(formatDiff(7)).toBe("+7");
    expect(formatDiff(-2)).toBe("-2");
    expect(formatDiff(0)).toBe("0");
  });

  it("never leaks internal terminology", () => {
    const banned = ["RPC", "RLS", "UUID", "JSON", "entitlement", "snapshot", "immutable", "database", "trigger", "repository"];
    const corpus = [
      ruleDescription("points"),
      ruleDescription("h2h"),
      ruleDescription("map_diff"),
      ruleDescription("round_diff"),
      ruleDescription("wins"),
      presetDescription("round_robin"),
      presetDescription("group_stage"),
      presetDescription("swiss_lite"),
    ].join(" ");
    for (const term of banned) {
      expect(corpus).not.toContain(term);
    }
  });
});
