// P6 roster schema tests (pure, no database).
// Covers the Zod input boundary: game-key allow/deny, name/id lengths, role
// vocabulary, notes cap, slot-count bounds, and hostile input.

import { describe, expect, it } from "vitest";
import {
  MAX_NOTES_LENGTH,
  isRosterBgmiRole,
  resolveRosterGameKey,
  rosterConfigFormSchema,
  rosterPlayerFormSchema,
} from "@/features/tools/roster/schema";

describe("resolveRosterGameKey", () => {
  it("accepts bgmi case-insensitively with whitespace", () => {
    expect(resolveRosterGameKey("bgmi")).toEqual({ ok: true, gameKey: "bgmi" });
    expect(resolveRosterGameKey("  BGMI ")).toEqual({ ok: true, gameKey: "bgmi" });
  });

  it("rejects planned titles with a distinct reason", () => {
    expect(resolveRosterGameKey("mlbb")).toEqual({ ok: false, reason: "planned" });
    expect(resolveRosterGameKey(" MLBB ")).toEqual({ ok: false, reason: "planned" });
  });

  it("rejects unknown keys as unsupported", () => {
    expect(resolveRosterGameKey("valorant").ok).toBe(false);
    expect(resolveRosterGameKey("").ok).toBe(false);
    expect(resolveRosterGameKey("BGMI!").ok).toBe(false);
  });
});

describe("roster vocabulary", () => {
  it("accepts the frozen BGMI roles and nothing else", () => {
    for (const role of ["IGL", "Assaulter", "Support", "Scout"]) {
      expect(isRosterBgmiRole(role)).toBe(true);
    }
    expect(isRosterBgmiRole("Sniper")).toBe(false);
    expect(isRosterBgmiRole("igl")).toBe(false);
    expect(isRosterBgmiRole("")).toBe(false);
  });
});

describe("rosterConfigFormSchema", () => {
  it("accepts a well-formed config", () => {
    const parsed = rosterConfigFormSchema.safeParse({
      teamName: "Team Soul Fan XI",
      gameKey: "bgmi",
      starterSlots: "4",
      substituteSlots: "2",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unsupported and planned game keys", () => {
    expect(
      rosterConfigFormSchema.safeParse({
        teamName: "",
        gameKey: "mlbb",
        starterSlots: 4,
        substituteSlots: 1,
      }).success,
    ).toBe(false);
    expect(
      rosterConfigFormSchema.safeParse({
        teamName: "",
        gameKey: "valorant",
        starterSlots: 4,
        substituteSlots: 1,
      }).success,
    ).toBe(false);
  });

  it("rejects out-of-range slot counts", () => {
    for (const starterSlots of [0, 7, -1, 99]) {
      expect(
        rosterConfigFormSchema.safeParse({
          teamName: "",
          gameKey: "bgmi",
          starterSlots,
          substituteSlots: 1,
        }).success,
        `starters=${starterSlots}`,
      ).toBe(false);
    }
    for (const substituteSlots of [-1, 7, 99]) {
      expect(
        rosterConfigFormSchema.safeParse({
          teamName: "",
          gameKey: "bgmi",
          starterSlots: 4,
          substituteSlots,
        }).success,
        `subs=${substituteSlots}`,
      ).toBe(false);
    }
  });

  it("rejects oversized team names", () => {
    expect(
      rosterConfigFormSchema.safeParse({
        teamName: "x".repeat(41),
        gameKey: "bgmi",
        starterSlots: 4,
        substituteSlots: 1,
      }).success,
    ).toBe(false);
  });
});

describe("rosterPlayerFormSchema", () => {
  function valid(overrides: Record<string, unknown> = {}) {
    return {
      displayName: "NovaX",
      playerId: "",
      role: "Flexible",
      notes: "",
      ...overrides,
    };
  }

  it("accepts a minimal player and a fully specified one", () => {
    expect(rosterPlayerFormSchema.safeParse(valid()).success).toBe(true);
    expect(
      rosterPlayerFormSchema.safeParse(
        valid({ playerId: "5123456789", role: "IGL", notes: "Shot-caller" }),
      ).success,
    ).toBe(true);
  });

  it("rejects blank, short, and oversized display names", () => {
    for (const displayName of ["", " ", "A", "x".repeat(25)]) {
      expect(rosterPlayerFormSchema.safeParse(valid({ displayName })).success).toBe(false);
    }
  });

  it("rejects short and oversized player ids but allows empty", () => {
    expect(rosterPlayerFormSchema.safeParse(valid({ playerId: "123" })).success).toBe(false);
    expect(
      rosterPlayerFormSchema.safeParse(valid({ playerId: "x".repeat(33) })).success,
    ).toBe(false);
  });

  it("rejects roles outside the BGMI vocabulary", () => {
    expect(rosterPlayerFormSchema.safeParse(valid({ role: "Sniper" })).success).toBe(false);
  });

  it("rejects oversized notes", () => {
    expect(
      rosterPlayerFormSchema.safeParse(valid({ notes: "n".repeat(MAX_NOTES_LENGTH + 1) })).success,
    ).toBe(false);
    expect(
      rosterPlayerFormSchema.safeParse(valid({ notes: "n".repeat(MAX_NOTES_LENGTH) })).success,
    ).toBe(true);
  });
});
