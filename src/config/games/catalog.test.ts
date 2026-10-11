import { describe, expect, it } from "vitest";
import { GAMES, getGameBySlug } from "./catalog";

describe("Game catalog", () => {
  it("contains exactly 10 first-wave games", () => {
    expect(GAMES).toHaveLength(10);
  });

  it("has unique slugs", () => {
    const slugs = GAMES.map((game) => game.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has non-empty display names", () => {
    for (const game of GAMES) {
      expect(game.name.trim().length).toBeGreaterThan(0);
    }
  });

  it("has non-empty short names", () => {
    for (const game of GAMES) {
      expect(game.shortName.trim().length).toBeGreaterThan(0);
    }
  });

  it("resolves cs2 to Counter-Strike 2", () => {
    expect(getGameBySlug("cs2")?.name).toBe("Counter-Strike 2");
  });

  it("resolves valorant to Valorant", () => {
    expect(getGameBySlug("valorant")?.name).toBe("Valorant");
  });

  it("resolves league-of-legends to League of Legends", () => {
    expect(getGameBySlug("league-of-legends")?.name).toBe(
      "League of Legends"
    );
  });

  it("resolves dota-2 to Dota 2", () => {
    expect(getGameBySlug("dota-2")?.name).toBe("Dota 2");
  });

  it("resolves pubg-mobile to PUBG Mobile", () => {
    expect(getGameBySlug("pubg-mobile")?.name).toBe("PUBG Mobile");
  });

  it("returns undefined for unknown slugs", () => {
    expect(getGameBySlug("mobile-legends")).toBeUndefined();
    expect(getGameBySlug("")).toBeUndefined();
    expect(getGameBySlug("not-a-game")).toBeUndefined();
  });

  it("resolves PUBG aliases", () => {
    expect(getGameBySlug("BGMI")?.slug).toBe("pubg-mobile");
    expect(getGameBySlug("Battlegrounds Mobile India")?.slug).toBe(
      "pubg-mobile"
    );
  });

  it("resolves League of Legends and Call of Duty aliases", () => {
    expect(getGameBySlug("LoL")?.slug).toBe("league-of-legends");
    expect(getGameBySlug("CoD")?.slug).toBe("call-of-duty");
  });

  it("has no Mobile Legends entry yet", () => {
    const slugs = GAMES.map((game) => game.slug);
    expect(slugs).not.toContain("mobile-legends");
    const names = GAMES.map((game) => game.name.toLowerCase());
    expect(names.some((name) => name.includes("mobile legends"))).toBe(false);
  });

  it("has no duplicate aliases", () => {
    const aliases = GAMES.flatMap((game) => [
      ...(game.aliases ?? []),
    ]).map((alias) => alias.toLowerCase());
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it("is static data with no runtime service dependency", () => {
    for (const game of GAMES) {
      expect(typeof game.slug).toBe("string");
      expect(typeof game.name).toBe("string");
      expect(typeof game.shortName).toBe("string");
    }
    expect(getGameBySlug("cs2")?.shortName).toBe("CS2");
  });
});
