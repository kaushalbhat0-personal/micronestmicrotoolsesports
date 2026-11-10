import { describe, expect, it } from "vitest";
import { buildFitReasons, type FitContext } from "./fit-reasons";

const base: FitContext = {
  playerRegion: "IN-North",
  playerCurrentLevel: "competitive",
  playerRoles: ["Scout", "Support"],
  playerOpenToTryout: true,
  playerVerified: false,
  postRegion: "IN-North",
  postLevelMin: "community",
  postRoleNeeded: "Scout",
  postTryoutRequired: true,
};

describe("fit reasons — factual, never scored", () => {
  it("reports met facts for a compatible player", () => {
    const reasons = buildFitReasons(base);
    expect(reasons.map((r) => r.key)).toEqual(["role", "region", "level", "tryout", "verification"]);
    expect(reasons.filter((r) => r.met).length).toBeGreaterThanOrEqual(4);
    const verification = reasons.find((r) => r.key === "verification");
    expect(verification?.met).toBe(false);
    expect(verification?.source).toBe("self-reported");
  });

  it("marks verification source as micronest-verified when verified", () => {
    const reasons = buildFitReasons({ ...base, playerVerified: true });
    const verification = reasons.find((r) => r.key === "verification");
    expect(verification?.met).toBe(true);
    expect(verification?.source).toBe("micronest-verified");
  });

  it("explains mismatches without scores or superlatives", () => {
    const reasons = buildFitReasons({
      ...base,
      playerRoles: ["IGL"],
      playerRegion: "IN-South",
      postRegion: "IN-North",
    });
    const role = reasons.find((r) => r.key === "role");
    expect(role?.met).toBe(false);
    for (const reason of reasons) {
      expect(reason.label).not.toMatch(/%/);
      expect(reason.label.toLowerCase()).not.toMatch(/perfect|best|guaranteed/);
    }
  });
});
