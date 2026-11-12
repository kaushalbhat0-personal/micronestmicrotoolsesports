import { describe, expect, it } from "vitest";
import {
  createGameProfileInputSchema,
  isRegionAllowedForGame,
  updateGameProfileInputSchema,
} from "../schemas/game-profile";

const VALID = {
  game_key: "bgmi",
  ign: "NovaScout",
};

describe("createGameProfileInputSchema (07 upsertGameProfile, 08 T4)", () => {
  it("accepts a minimal BGMI profile; optionals stay absent", () => {
    const parsed = createGameProfileInputSchema.parse(VALID);
    expect(parsed.game_key).toBe("bgmi");
    expect(parsed.ign).toBe("NovaScout");
    expect(parsed.game_user_id).toBeUndefined();
    expect(parsed.primary_role).toBeUndefined();
    expect(parsed.play_modes).toBeUndefined();
    expect(parsed.region_code).toBeUndefined();
    expect(parsed.availability).toBeUndefined();
    expect(parsed.is_visible).toBeUndefined();
  });

  it("accepts full optionals and normalizes them", () => {
    const parsed = createGameProfileInputSchema.parse({
      ...VALID,
      game_key: " BGMI ",
      ign: "  Nova  ",
      game_user_id: "001234",
      primary_role: "Scout",
      play_modes: ["squad", "tpp"],
      region_code: "INDIA",
      availability: ["weekend"],
      is_visible: false,
    });
    expect(parsed.game_key).toBe("bgmi");
    expect(parsed.ign).toBe("Nova");
    expect(parsed.game_user_id).toBe("001234");
    expect(parsed.primary_role).toBe("Scout");
    expect(parsed.play_modes).toEqual(["squad", "tpp"]);
    expect(parsed.region_code).toBe("india");
    expect(parsed.availability).toEqual(["weekend"]);
    expect(parsed.is_visible).toBe(false);
  });

  it("permits ONLINE as a BGMI region but never as a country", () => {
    expect(
      createGameProfileInputSchema.parse({ ...VALID, region_code: "ONLINE" })
        .region_code,
    ).toBe("online");
  });

  it("rejects regions outside the game's vocabulary (D-G1-09)", () => {
    expect(
      createGameProfileInputSchema.safeParse({
        ...VALID,
        region_code: "atlantis",
      }).success,
    ).toBe(false);
    // Unknown game + region: fail closed (no vocabulary to check against).
    expect(
      createGameProfileInputSchema.safeParse({
        game_key: "some-future-title",
        ign: "Nova",
        region_code: "india",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid roles, modes, IGN and identifiers", () => {
    expect(
      createGameProfileInputSchema.safeParse({ ...VALID, primary_role: "Sniper" })
        .success,
    ).toBe(false);
    expect(
      createGameProfileInputSchema.safeParse({ ...VALID, play_modes: ["ranked"] })
        .success,
    ).toBe(false);
    expect(
      createGameProfileInputSchema.safeParse({
        ...VALID,
        play_modes: ["squad", "duo", "solo", "tpp", "fpp", "extra"],
      }).success,
    ).toBe(false);
    expect(
      createGameProfileInputSchema.safeParse({ ...VALID, ign: "x" }).success,
    ).toBe(false);
    expect(
      createGameProfileInputSchema.safeParse({
        ...VALID,
        availability: new Array(8).fill("weekend"),
      }).success,
    ).toBe(false);
    expect(
      createGameProfileInputSchema.safeParse({ ...VALID, game_user_id: "123" })
        .success,
    ).toBe(false);
  });

  it("rejects mass-assigned ownership/identity fields", () => {
    for (const extra of [
      { player_user_id: "someone-else" },
      { id: "some-uuid" },
      { user_id: "someone-else" },
      { status: "active" },
      { created_at: new Date().toISOString() },
    ]) {
      expect(
        createGameProfileInputSchema.safeParse({ ...VALID, ...extra }).success,
      ).toBe(false);
    }
  });
});

describe("updateGameProfileInputSchema (07, 08 T4)", () => {
  it("accepts a partial patch and explicit nulls (clearing)", () => {
    expect(updateGameProfileInputSchema.parse({ ign: "NovaPrime" })).toEqual({
      ign: "NovaPrime",
    });
    expect(
      updateGameProfileInputSchema.parse({ primary_role: null, region_code: null }),
    ).toEqual({ primary_role: null, region_code: null });
    expect(updateGameProfileInputSchema.parse({ is_visible: false })).toEqual({
      is_visible: false,
    });
  });

  it("rejects an empty patch", () => {
    expect(updateGameProfileInputSchema.safeParse({}).success).toBe(false);
  });

  it("rejects identity selectors in the patch (ownership immutable)", () => {
    for (const bad of [
      { game_key: "bgmi" },
      { player_user_id: "someone-else" },
      { id: "some-uuid" },
      { ign: "Nova", game_key: "bgmi" },
      { ign: "Nova", player_user_id: "someone-else" },
    ]) {
      expect(updateGameProfileInputSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("rejects invalid values", () => {
    expect(
      updateGameProfileInputSchema.safeParse({ ign: "x" }).success,
    ).toBe(false);
    expect(
      updateGameProfileInputSchema.safeParse({ primary_role: "Sniper" }).success,
    ).toBe(false);
    expect(
      updateGameProfileInputSchema.safeParse({ play_modes: ["ranked"] }).success,
    ).toBe(false);
  });
});

describe("isRegionAllowedForGame (D-G1-09 dispatcher)", () => {
  it("accepts BGMI vocab, rejects unknown games", () => {
    expect(isRegionAllowedForGame("bgmi", "online")).toBe(true);
    expect(isRegionAllowedForGame("bgmi", "atlantis")).toBe(false);
    expect(isRegionAllowedForGame("some-future-title", "india")).toBe(false);
  });
});
