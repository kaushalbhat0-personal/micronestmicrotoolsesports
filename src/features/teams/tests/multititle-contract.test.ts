// D1.6.1 multi-title contract — PURE-UNIT tests (no PostgreSQL, no RLS).
// Proves BGMI behavior unchanged and the architecture gates future titles
// without activating them. Precedent: team schemas already import the
// player-profile game boundary (team.ts), so this test location is compliant.
import { describe, expect, it } from "vitest";
import {
  PLANNED_GAME_KEYS,
  SUPPORTED_GAME_KEYS,
  SUPPORTED_GAMES,
  getGameByKey,
  isPlannedGameKey,
  isSupportedGameKey,
  resolveSupportedGameKey,
} from "@/lib/game-catalog/catalog";
import { BGMI_REGION_VOCABULARY, gameKeySchema, validateGameRegion } from "@/features/player-profile/schemas/game";
import { isSupportedGame } from "../domain/roles";
import { teamSchema } from "../schemas/team";

describe("stable BGMI launch contract (unchanged)", () => {
  it("supported set is exactly bgmi; identity matches the DB seed", () => {
    expect([...SUPPORTED_GAME_KEYS]).toEqual(["bgmi"]);
    expect(SUPPORTED_GAMES).toHaveLength(1);
    expect(SUPPORTED_GAMES[0]?.key).toBe("bgmi");
    expect(SUPPORTED_GAMES[0]?.name).toBe("Battlegrounds Mobile India");
    expect(SUPPORTED_GAMES[0]?.shortName).toBe("BGMI");
  });
  it("team creation accepts only bgmi", () => {
    const base = {
      slug: "alpha-esports",
      name: "Alpha",
      regionCode: "india",
      currentLevel: "casual",
      targetLevel: "competitive",
    } as const;
    expect(teamSchema.safeParse({ ...base, gameKey: "bgmi" }).success).toBe(true);
    expect(teamSchema.safeParse({ ...base, gameKey: "mlbb" }).success).toBe(false);
    expect(teamSchema.safeParse({ ...base, gameKey: "valorant" }).success).toBe(false);
  });
  it("BGMI vocabulary constants are unchanged", () => {
    expect([...BGMI_REGION_VOCABULARY]).toEqual([
      "india",
      "asia",
      "europe",
      "north-america",
      "south-america",
      "middle-east",
      "online",
    ]);
    expect(isSupportedGame("bgmi")).toBe(true);
  });
});

describe("catalogue extensibility without activation", () => {
  it("planned titles are recognized but never enabled", () => {
    expect([...PLANNED_GAME_KEYS]).toContain("mlbb");
    expect(isPlannedGameKey("mlbb")).toBe(true);
    expect(isSupportedGameKey("mlbb")).toBe(false);
    expect(resolveSupportedGameKey("mlbb")).toBeUndefined();
  });
  it("unknown titles fail closed and never throw", () => {
    expect(getGameByKey("valorant")).toBeUndefined();
    expect(isSupportedGameKey("valorant")).toBe(false);
    expect(isPlannedGameKey("valorant")).toBe(false);
    expect(resolveSupportedGameKey("valorant")).toBeUndefined();
    expect(resolveSupportedGameKey("")).toBeUndefined();
  });
  it("key format validation is separate from activation gating", () => {
    // Format layer accepts any well-formed future key; activation is the
    // catalogue's job. This separation is the multi-title extension point.
    expect(gameKeySchema.safeParse("valorant").success).toBe(true);
    expect(gameKeySchema.safeParse("mlbb").success).toBe(true);
    expect(gameKeySchema.safeParse("BAD KEY!").success).toBe(false);
    expect(isSupportedGameKey("valorant")).toBe(false);
  });
});

describe("platform identity independent of game identity", () => {
  it("per-game vocabularies never leak onto unknown titles", () => {
    expect(validateGameRegion("bgmi", "india")).toBe(true);
    expect(validateGameRegion("valorant", "india")).toBe(false);
    expect(validateGameRegion("mlbb", "india")).toBe(false);
    expect(validateGameRegion("", "india")).toBe(false);
  });
  it("BGMI regions are game-server values, not platform values", () => {
    // 'online' is valid as a BGMI server region; it must never be read as a
    // platform/country attribute (D-G1-09 separation).
    expect(validateGameRegion("bgmi", "online")).toBe(true);
    expect(validateGameRegion("bgmi", "atlantis")).toBe(false);
  });
});
