import { describe, expect, it } from "vitest";
import {
  BGMI_ROLES,
  GAME_ROLES,
  isRoleForGame,
  isSupportedGame,
  MLBB_ROLES,
  regionsCompatible,
} from "./roles";

describe("finder roles", () => {
  it("supports BGMI only at launch", () => {
    expect(isSupportedGame("bgmi")).toBe(true);
    expect(isSupportedGame("mlbb")).toBe(false);
  });

  it("defines the four BGMI roles", () => {
    expect([...BGMI_ROLES]).toEqual(["IGL", "Assaulter", "Support", "Scout"]);
    expect(GAME_ROLES.bgmi).toEqual(BGMI_ROLES);
  });

  it("validates roles per game without cross-game leakage", () => {
    expect(isRoleForGame("bgmi", "IGL")).toBe(true);
    expect(isRoleForGame("bgmi", "Jungle")).toBe(false);
    expect(isRoleForGame("bgmi", "AWPer")).toBe(false);
    expect(isRoleForGame("bgmi", undefined)).toBe(false);
  });

  it("reserves MLBB roles as config only, without enabling the game", () => {
    expect([...MLBB_ROLES]).toEqual(["EXP", "Jungle", "Mid", "Gold", "Roam"]);
    expect(isSupportedGame("mlbb")).toBe(false);
  });

  it("matches equal broad regions and any-region openness", () => {
    expect(regionsCompatible("IN-North", "IN-North")).toBe(true);
    expect(regionsCompatible("IN-North", "IN-South")).toBe(false);
    expect(regionsCompatible("any", "IN-South")).toBe(true);
    expect(regionsCompatible("IN-North", "Pan-India")).toBe(true);
    expect(regionsCompatible("  in-north ", "IN-NORTH")).toBe(true);
  });
});
