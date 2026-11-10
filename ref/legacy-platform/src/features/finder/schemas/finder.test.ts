import { describe, expect, it } from "vitest";
import {
  applicationSchema,
  characterIdSchema,
  finderProfileSchema,
  gameProfileSchema,
  handleSchema,
  myProfileSaveSchema,
  recruitmentPostSchema,
  reportSchema,
  teamSchema,
} from "./finder";

describe("finder schemas", () => {
  it("accepts valid lowercase handles and normalizes case", () => {
    expect(handleSchema.parse("assault_07")).toBe("assault_07");
    expect(handleSchema.parse("Assault_07")).toBe("assault_07");
  });

  it("rejects short, long, or invalid handles", () => {
    expect(() => handleSchema.parse("ab")).toThrow();
    expect(() => handleSchema.parse("a".repeat(21))).toThrow();
    expect(() => handleSchema.parse("bad-handle")).toThrow();
    expect(() => handleSchema.parse("has space")).toThrow();
    expect(() => handleSchema.parse("UPPER")).not.toThrow();
  });

  it("preserves Character ID as text with leading zeroes", () => {
    const parsed = characterIdSchema.parse("00123456");
    expect(typeof parsed).toBe("string");
    expect(parsed).toBe("00123456");
  });

  it("rejects non-numeric or out-of-range Character IDs", () => {
    expect(() => characterIdSchema.parse("ABC123")).toThrow();
    expect(() => characterIdSchema.parse("123")).toThrow();
    expect(() => characterIdSchema.parse("1".repeat(13))).toThrow();
    expect(() => characterIdSchema.parse(123456)).toThrow();
  });

  it("validates the player profile contract", () => {
    const valid = finderProfileSchema.parse({
      handle: "igl_captain",
      display_name: "Captain",
      region: "IN-North",
      current_level: "community",
      target_level: "competitive",
      primary_role: "IGL",
    });
    expect(valid.looking_for).toBe(true);
    expect(valid.allow_indexing).toBe(false);

    expect(() =>
      finderProfileSchema.parse({
        handle: "igl_captain",
        display_name: "Captain",
        region: "IN-North",
        current_level: "diamond",
        target_level: "competitive",
        primary_role: "IGL",
      }),
    ).toThrow();
  });

  it("caps bio length at 280 characters", () => {
    expect(() =>
      finderProfileSchema.parse({
        handle: "scout_01",
        display_name: "Scout",
        region: "IN-South",
        current_level: "casual",
        target_level: "community",
        primary_role: "Scout",
        bio: "x".repeat(281),
      }),
    ).toThrow();
  });

  it("restricts game profiles to BGMI", () => {
    expect(() =>
      gameProfileSchema.parse({ game: "mlbb", ign: "Pro", character_id: "00123456" }),
    ).toThrow();
    expect(
      gameProfileSchema.parse({ game: "bgmi", ign: "Pro", character_id: "00123456" }).game,
    ).toBe("bgmi");
  });

  it("constrains recruitment slots to 1–10", () => {
    const base = {
      role_needed: "Assaulter",
      current_level_min: "competitive",
      target_level: "higher-tier",
      region: "IN-North",
    };
    expect(recruitmentPostSchema.parse({ ...base, slots: 1 }).slots).toBe(1);
    expect(() => recruitmentPostSchema.parse({ ...base, slots: 0 })).toThrow();
    expect(() => recruitmentPostSchema.parse({ ...base, slots: -2 })).toThrow();
    expect(() => recruitmentPostSchema.parse({ ...base, slots: 11 })).toThrow();
    expect(() => recruitmentPostSchema.parse({ ...base, slots: 1.5 })).toThrow();
  });

  it("caps application notes at 200 characters", () => {
    expect(() => applicationSchema.parse({ note: "x".repeat(201) })).toThrow();
    expect(applicationSchema.parse({ note: "Tryout ready." }).note).toBe("Tryout ready.");
  });

  it("validates team slugs and report reasons", () => {    expect(teamSchema.parse({
      slug: "team-tamilas",
      name: "Team Tamilas",
      region: "IN-South",
      current_level: "competitive",
      target_level: "higher-tier",
    }).slug).toBe("team-tamilas");
    expect(() =>
      teamSchema.parse({
        slug: "Bad Slug!",
        name: "X",
        region: "IN-South",
        current_level: "competitive",
        target_level: "higher-tier",
      }),
    ).toThrow();

    expect(() =>
      reportSchema.parse({
        target_type: "player",
        target_id: "not-a-uuid",
        reason: "This reason is long enough to pass.",
      }),
    ).toThrow();
    expect(() =>
      reportSchema.parse({
        target_type: "team",
        target_id: "123e4567-e89b-12d3-a456-426614174000",
        reason: "Too short",
      }),
    ).toThrow();
  });

  it("validates the Phase B profile save payload with safe defaults", () => {
    const base = {
      profile: {
        handle: "scout_07",
        display_name: "Scout",
        region: "IN-South",
        current_level: "casual",
        target_level: "community",
        primary_role: "Scout",
      },
      game: { game: "bgmi", ign: "ScoutIN", character_id: "00123456" },
    };
    const parsed = myProfileSaveSchema.parse(base);
    expect(parsed.profile.languages).toEqual([]);
    expect(parsed.profile.secondary_roles).toEqual([]);
    expect(parsed.profile.availability).toEqual([]);
    expect(parsed.profile.looking_for).toBe(true);
  });

  it("caps secondary roles, languages, and availability windows", () => {
    const base = {
      profile: {
        handle: "igl_01",
        display_name: "IGL",
        region: "IN-North",
        current_level: "competitive",
        target_level: "higher-tier",
        primary_role: "IGL",
        secondary_roles: ["Assaulter", "Support", "Scout", "IGL"],
        languages: ["a", "b", "c", "d", "e", "f"],
      },
      game: { game: "bgmi", ign: "IGLIN", character_id: "123456" },
    };
    expect(() => myProfileSaveSchema.parse(base)).toThrow();
  });
});
