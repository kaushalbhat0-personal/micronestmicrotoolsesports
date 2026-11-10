import { describe, expect, it } from "vitest";
import {
  availabilityOverlaps,
  hardFiltersPass,
  rankMatch,
  type MatchPlayer,
  type MatchPost,
} from "./matching";

const basePlayer: MatchPlayer = {
  game: "bgmi",
  lookingFor: true,
  region: "IN-North",
  primaryRole: "Assaulter",
  secondaryRoles: ["Support"],
  currentLevel: "competitive",
  targetLevel: "higher-tier",
  availability: ["weekday-evenings", "8-11-pm-ist"],
  verified: false,
  tournamentEvidenceCount: 0,
  labActivityCount: 0,
};

const basePost: MatchPost = {
  game: "bgmi",
  status: "open",
  region: "IN-North",
  roleNeeded: "Assaulter",
  currentLevelMin: "competitive",
  targetLevel: "higher-tier",
  availabilityRequired: ["weekday-evenings"],
};

describe("finder matching — hard filters", () => {
  it("passes when every hard criterion aligns", () => {
    const result = hardFiltersPass(basePlayer, basePost);
    expect(result.pass).toBe(true);
    expect(result.blockedBy).toEqual([]);
  });

  it("blocks on game mismatch", () => {
    const result = hardFiltersPass({ ...basePlayer, game: "valorant" }, basePost);
    expect(result.pass).toBe(false);
    expect(result.blockedBy).toContain("Different game");
  });

  it("blocks closed or paused recruitment", () => {
    for (const status of ["paused", "closed", "filled"]) {
      const result = hardFiltersPass(basePlayer, { ...basePost, status });
      expect(result.pass).toBe(false);
      expect(result.blockedBy).toContain("Recruitment is not open");
    }
  });

  it("blocks players who are not looking", () => {
    const result = hardFiltersPass({ ...basePlayer, lookingFor: false }, basePost);
    expect(result.pass).toBe(false);
    expect(result.blockedBy).toContain("Player is not looking for a team");
  });

  it("blocks on region mismatch", () => {
    const result = hardFiltersPass({ ...basePlayer, region: "IN-South" }, basePost);
    expect(result.pass).toBe(false);
    expect(result.blockedBy).toContain("Region mismatch");
  });

  it("accepts secondary roles but blocks unrelated roles", () => {
    const secondary = hardFiltersPass(basePlayer, { ...basePost, roleNeeded: "Support" });
    expect(secondary.pass).toBe(true);

    const blocked = hardFiltersPass(basePlayer, { ...basePost, roleNeeded: "IGL" });
    expect(blocked.pass).toBe(false);
    expect(blocked.blockedBy.some((reason) => reason.includes("IGL"))).toBe(true);
  });

  it("enforces the one-step-below level window", () => {
    const oneBelow = hardFiltersPass(
      { ...basePlayer, currentLevel: "community" },
      basePost,
    );
    expect(oneBelow.pass).toBe(true);

    const twoBelow = hardFiltersPass({ ...basePlayer, currentLevel: "casual" }, basePost);
    expect(twoBelow.pass).toBe(false);
  });
});

describe("finder matching — availability overlap", () => {
  it("treats empty requirements as overlap", () => {
    expect(availabilityOverlaps(basePlayer.availability, [])).toBe(true);
  });

  it("matches shared tokens case-insensitively", () => {
    expect(availabilityOverlaps(["Weekday Evenings"], ["weekday-evenings"])).toBe(true);
    expect(availabilityOverlaps(["mornings"], ["evenings"])).toBe(false);
  });
});

describe("finder matching — tiers and explanations", () => {
  it("ranks a fully aligned profile as strong", () => {
    const result = rankMatch(
      { ...basePlayer, verified: true, labActivityCount: 3 },
      basePost,
    );
    expect(result.tier).toBe("strong");
    expect(result.blockedBy).toEqual([]);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons.every((reason) => reason.label.length > 0)).toBe(true);
  });

  it("ranks core fit without trust signals as good, not strong", () => {
    const result = rankMatch(basePlayer, basePost);
    expect(result.tier).toBe("good");
  });

  it("ranks level/role-only fit as a stretch, never a number", () => {
    const result = rankMatch(
      {
        ...basePlayer,
        targetLevel: "semi-pro",
        availability: ["mornings"],
      },
      basePost,
    );
    expect(result.tier).toBe("stretch");
    const labels = result.reasons.map((reason) => reason.label).join(" ");
    expect(labels).not.toMatch(/\d{2,3}%\s*match/i);
  });

  it("returns no-match with blocked reasons when hard filters fail", () => {
    const result = rankMatch({ ...basePlayer, lookingFor: false }, basePost);
    expect(result.tier).toBe("no-match");
    expect(result.blockedBy.length).toBeGreaterThan(0);
    expect(result.reasons).toEqual([]);
  });

  it("distinguishes verified and self-reported evidence in copy", () => {
    const verified = rankMatch({ ...basePlayer, verified: true }, basePost);
    const unverified = rankMatch(basePlayer, basePost);
    const verifiedCopy = verified.reasons.map((reason) => reason.label).join(" ");
    const unverifiedCopy = unverified.reasons.map((reason) => reason.label).join(" ");
    expect(verifiedCopy).toMatch(/verified/i);
    expect(unverifiedCopy).toMatch(/self-reported/);
    expect(verifiedCopy).not.toMatch(/skill rating| K\/D |rank verified/i);
  });

  it("is deterministic: same inputs always produce the same tier", () => {
    const first = rankMatch(basePlayer, basePost);
    const second = rankMatch({ ...basePlayer }, { ...basePost });
    expect(second).toEqual(first);
  });
});
