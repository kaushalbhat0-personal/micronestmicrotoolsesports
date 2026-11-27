// D1 game catalogue tests.
import { describe, expect, it } from "vitest";
import { getGameByKey, isPlannedGameKey, isSupportedGameKey, resolveSupportedGameKey } from "./catalog";

describe("game catalog (BGMI-first)", () => {
  it("resolves bgmi key and aliases", () => {
    expect(getGameByKey("bgmi")?.shortName).toBe("BGMI");
    expect(getGameByKey("BGMI")?.key).toBe("bgmi");
    expect(getGameByKey("pubg-mobile")?.key).toBe("bgmi");
    expect(getGameByKey("  Battlegrounds Mobile India ")?.key).toBe("bgmi");
  });
  it("accepts only bgmi as supported", () => {
    expect(isSupportedGameKey("bgmi")).toBe(true);
    expect(isSupportedGameKey("BGMI")).toBe(true);
    expect(isSupportedGameKey("valorant")).toBe(false);
    expect(isSupportedGameKey("mlbb")).toBe(false);
  });
  it("recognizes planned titles without enabling them", () => {
    expect(isPlannedGameKey("mlbb")).toBe(true);
    expect(resolveSupportedGameKey("mlbb")).toBeUndefined();
    expect(resolveSupportedGameKey("valorant")).toBeUndefined();
  });
  it("never throws on unknown input", () => {
    expect(getGameByKey("unknown-game-xyz")).toBeUndefined();
    expect(resolveSupportedGameKey("")).toBeUndefined();
  });
});
