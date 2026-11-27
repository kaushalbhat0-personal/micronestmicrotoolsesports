import { describe, expect, it } from "vitest";
import { buildAliasMap, CHECKED_IN_ALIASES, heroKeyFromApiName, resolveHeroName } from "./hero-aliases";
import heroesSample from "./fixtures/heroes-sample.json";

describe("dota hero aliases", () => {
  it("builds a key→canonical map from /api/heroes rows", () => {
    const map = buildAliasMap(heroesSample);
    expect(map.get("rattletrap")).toBe("Clockwerk");
    expect(map.get("wisp")).toBe("Io");
    expect(map.get("necrolyte")).toBe("Necrophos");
    expect(map.get("windrunner")).toBe("Windranger");
  });

  it("resolves verified aliases to canonical names", () => {
    const map = buildAliasMap(heroesSample);
    expect(resolveHeroName("rattletrap", map).displayName).toBe("Clockwerk");
    expect(resolveHeroName("wisp", map).displayName).toBe("Io");
    expect(resolveHeroName("necrolyte", map).displayName).toBe("Necrophos");
  });

  it("falls back to checked-in aliases without the API map", () => {
    expect(resolveHeroName("rattletrap", new Map(), CHECKED_IN_ALIASES).hit).toBe("canonical");
    expect(resolveHeroName("wisp", new Map()).normalized).toBe("io");
  });

  it("falls back to a normalized key for unknown heroes (no fuzzy match)", () => {
    const resolved = resolveHeroName("some_new_hero", new Map());
    expect(resolved.hit).toBe("fallback");
    expect(resolved.displayName).toBe("some new hero");
    expect(resolved.normalized).toBe("some new hero");
  });

  it("rejects malformed api names", () => {
    expect(heroKeyFromApiName("npc_dota_hero_")).toBeNull();
    expect(heroKeyFromApiName("not_a_hero")).toBeNull();
    expect(buildAliasMap([{ name: "bad", localized_name: "" }]).size).toBe(0);
  });
});
