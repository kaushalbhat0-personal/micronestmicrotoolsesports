// D1 teams domain tests (independent coverage).
import { describe, expect, it } from "vitest";
import { isCompetitiveLevel, meetsLevelMinimum } from "../domain/levels";
import { isRoleForGame, isSupportedGame, regionsCompatible } from "../domain/roles";
import { hardFiltersPass, rankMatch } from "../domain/matching";
import { applicationSchema, recruitmentPostSchema, reportSchema, teamSchema } from "../schemas/team";
import { parsePlayerSearchParams, parseTeamSearchParams } from "../services/search";

describe("levels", () => {
  it("accepts valid levels and enforces 1-below window", () => {
    expect(isCompetitiveLevel("semi-pro")).toBe(true);
    expect(isCompetitiveLevel("diamond")).toBe(false);
    expect(meetsLevelMinimum("community", "competitive")).toBe(true);
    expect(meetsLevelMinimum("casual", "competitive")).toBe(false);
  });
});

describe("roles", () => {
  it("supports bgmi only", () => {
    expect(isSupportedGame("bgmi")).toBe(true);
    expect(isSupportedGame("mlbb")).toBe(false);
    expect(isRoleForGame("bgmi", "IGL")).toBe(true);
    expect(isRoleForGame("bgmi", "AWP")).toBe(false);
  });
  it("matches broad regions", () => {
    expect(regionsCompatible("india", "india")).toBe(true);
    expect(regionsCompatible("online", "europe")).toBe(true);
  });
});

describe("matching (no scores)", () => {
  const player = {
    game: "bgmi",
    lookingFor: true,
    region: "india",
    primaryRole: "IGL",
    secondaryRoles: ["Support"],
    currentLevel: "competitive" as const,
    targetLevel: "semi-pro" as const,
    availability: ["weekend"],
    verified: false,
    tournamentEvidenceCount: 0,
    labActivityCount: 0,
  };
  const post = {
    game: "bgmi",
    status: "open",
    region: "india",
    roleNeeded: "IGL",
    currentLevelMin: "competitive" as const,
    targetLevel: "semi-pro" as const,
    availabilityRequired: ["weekend"],
  };
  it("passes hard filters and tiers without scores", () => {
    expect(hardFiltersPass(player, post).pass).toBe(true);
    const r = rankMatch(player, post);
    expect(["strong", "good", "stretch"]).toContain(r.tier);
    expect(r.blockedBy).toEqual([]);
  });
  it("blocks closed posts and role mismatch", () => {
    expect(hardFiltersPass(player, { ...post, status: "closed" }).pass).toBe(false);
    expect(hardFiltersPass(player, { ...post, roleNeeded: "Scout" }).pass).toBe(false);
  });
});

describe("team schemas", () => {
  it("accepts bgmi teams, rejects bad slugs and other games", () => {
    expect(teamSchema.safeParse({ slug: "alpha-esports", name: "Alpha", gameKey: "bgmi", regionCode: "india", currentLevel: "casual", targetLevel: "competitive" }).success).toBe(true);
    expect(teamSchema.safeParse({ slug: "bad slug!", name: "x", gameKey: "bgmi", regionCode: "india", currentLevel: "casual", targetLevel: "competitive" }).success).toBe(false);
    expect(teamSchema.safeParse({ slug: "ok", name: "Alpha", gameKey: "valorant", regionCode: "india", currentLevel: "casual", targetLevel: "competitive" }).success).toBe(false);
  });
  it("bounds recruitment and reports", () => {
    expect(recruitmentPostSchema.safeParse({ roleNeeded: "IGL", slots: 5, currentLevelMin: "casual", targetLevel: "casual", regionCode: "india" }).success).toBe(true);
    expect(recruitmentPostSchema.safeParse({ roleNeeded: "IGL", slots: 99, currentLevelMin: "casual", targetLevel: "casual", regionCode: "india" }).success).toBe(false);
    expect(applicationSchema.safeParse({ note: "x".repeat(201) }).success).toBe(false);
    expect(reportSchema.safeParse({ targetType: "team", targetId: "11111111-1111-4111-8111-111111111111", reason: "short" }).success).toBe(false);
  });
});

describe("search parsers", () => {
  it("defaults bgmi and ignores unknown enums", () => {
    expect(parseTeamSearchParams({}).game).toBe("bgmi");
    expect(parseTeamSearchParams({ region: "atlantis" }).regionCode).toBeUndefined();
    expect(parseTeamSearchParams({ recruiting: "0" }).recruitingOnly).toBe(false);
    expect(parsePlayerSearchParams({ role: "nope" }).role).toBeUndefined();
  });
});
