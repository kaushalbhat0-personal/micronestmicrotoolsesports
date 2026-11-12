// G1-7 profile-completeness helper tests (pure unit, no network).
// Lane: pure unit. Authoritative: D-G1-08 approved set (2026-11-11):
// complete = handle + display name + (avatar OR non-empty bio) + >=1 game
// profile. Derived, never stored; informational only (no verification,
// trust, eligibility, skill or ranking implication).

import { describe, expect, it } from "vitest";
import { getProfileCompleteness } from "../server/completeness";

describe("getProfileCompleteness (D-G1-08)", () => {
  it("marks a fully populated profile complete", async () => {
    const { complete, missing } = await Promise.resolve(
      getProfileCompleteness(
        {
          handle: "nova_01",
          displayName: "Nova",
          avatarPath: "uid/avatar.png",
          bio: null,
        },
        1,
      ),
    );
    expect(complete).toBe(true);
    expect(missing).toEqual([]);
  });

  it("accepts bio-only (no avatar) and avatar-only (no bio)", () => {
    expect(
      getProfileCompleteness(
        { handle: "nova_01", displayName: "Nova", avatarPath: null, bio: "BGMI scout." },
        1,
      ).complete,
    ).toBe(true);
    expect(
      getProfileCompleteness(
        { handle: "nova_01", displayName: "Nova", avatarPath: "uid/avatar.jpg", bio: null },
        1,
      ).complete,
    ).toBe(true);
  });

  it("flags missing handle", () => {
    const result = getProfileCompleteness(
      { handle: null, displayName: "Nova", avatarPath: "uid/avatar.png", bio: null },
      1,
    );
    expect(result.complete).toBe(false);
    expect(result.missing).toContain("handle");
  });

  it("flags missing display name (blank names do not count)", () => {
    for (const displayName of [null, "", "   "]) {
      const result = getProfileCompleteness(
        { handle: "nova_01", displayName, avatarPath: "uid/avatar.png", bio: null },
        1,
      );
      expect(result.complete).toBe(false);
      expect(result.missing).toContain("display_name");
    }
  });

  it("flags neither avatar nor bio (blank bio does not count)", () => {
    for (const bio of [null, "", "   "]) {
      const result = getProfileCompleteness(
        { handle: "nova_01", displayName: "Nova", avatarPath: null, bio },
        1,
      );
      expect(result.complete).toBe(false);
      expect(result.missing).toContain("avatar_or_bio");
    }
  });

  it("flags zero game profiles; accepts one and many", () => {
    expect(
      getProfileCompleteness(
        { handle: "nova_01", displayName: "Nova", avatarPath: "uid/avatar.png", bio: null },
        0,
      ),
    ).toEqual({ complete: false, missing: ["game_profile"] });
    expect(
      getProfileCompleteness(
        { handle: "nova_01", displayName: "Nova", avatarPath: "uid/avatar.png", bio: null },
        1,
      ).complete,
    ).toBe(true);
    expect(
      getProfileCompleteness(
        { handle: "nova_01", displayName: "Nova", avatarPath: null, bio: "Scout." },
        3,
      ).complete,
    ).toBe(true);
  });

  it("reports every missing requirement together", () => {
    expect(
      getProfileCompleteness(
        { handle: null, displayName: null, avatarPath: null, bio: null },
        0,
      ),
    ).toEqual({
      complete: false,
      missing: ["handle", "display_name", "avatar_or_bio", "game_profile"],
    });
  });
});
