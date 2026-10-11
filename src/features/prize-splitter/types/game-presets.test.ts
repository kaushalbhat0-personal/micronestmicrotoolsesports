import { describe, expect, it } from "vitest";
import { GAMES } from "@/config/games/catalog";
import {
  GAME_PRESETS,
  RANKED_PRESETS,
  getGamePresetById,
  type GamePrizePreset,
  type SplitInput,
} from "./index";
import { validateInput } from "../services/calculation";

const EXPECTED_SLUGS = [
  "cs2",
  "valorant",
  "league-of-legends",
  "dota-2",
  "rainbow-six-siege",
  "pubg-mobile",
  "fortnite",
  "rocket-league",
  "apex-legends",
  "call-of-duty",
] as const;

function toSplitInput(preset: GamePrizePreset): SplitInput {
  return {
    prizePool: 100000,
    currency: "INR",
    method: preset.method,
    placements: preset.placements.map((p) => ({ ...p })),
  };
}

describe("Game prize presets", () => {
  it("contains exactly 10 first-wave game presets", () => {
    expect(GAME_PRESETS).toHaveLength(10);
  });

  it("references only valid catalog GameSlugs", () => {
    const slugs = new Set(GAMES.map((game) => game.slug));
    for (const preset of GAME_PRESETS) {
      expect(slugs.has(preset.gameSlug)).toBe(true);
    }
  });

  it("has unique preset ids", () => {
    const ids = GAME_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("totals exactly 100% per preset under existing validation", () => {
    for (const preset of GAME_PRESETS) {
      const result = validateInput(toSplitInput(preset));
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    }
  });

  it("applies through the existing placement mechanism into valid SplitInput", () => {
    for (const preset of GAME_PRESETS) {
      const input = toSplitInput(preset);
      expect(input.method).toBe(preset.method);
      expect(input.placements).toHaveLength(preset.placements.length);
      expect(validateInput(input).valid).toBe(true);
    }
  });

  it("leaves applied state editable (copies, not references)", () => {
    const preset = getGamePresetById("cs2-major");
    expect(preset).toBeDefined();
    if (!preset) return;
    const input = toSplitInput(preset);
    input.placements[0] = { label: "1st", percentage: 29 };
    input.placements[1] = { label: "2nd", percentage: 21 };
    expect(preset.placements[0]?.percentage).not.toBe(29);
    expect(validateInput(input).valid).toBe(true);
  });

  it("introduces no invalid placements", () => {
    for (const preset of GAME_PRESETS) {
      expect(preset.placements.length).toBeGreaterThan(0);
      expect(preset.placements.length).toBeLessThanOrEqual(100);
      const labels = preset.placements.map((p) => p.label.trim().toLowerCase());
      expect(new Set(labels).size).toBe(labels.length);
      for (const placement of preset.placements) {
        expect(placement.label.trim().length).toBeGreaterThan(0);
        expect(Number.isFinite(placement.percentage)).toBe(true);
        expect(placement.percentage).toBeGreaterThanOrEqual(0);
        expect(placement.percentage).toBeLessThanOrEqual(100);
      }
    }
  });

  it("covers all ten expected games", () => {
    const covered = new Set(GAME_PRESETS.map((preset) => preset.gameSlug));
    for (const slug of EXPECTED_SLUGS) {
      expect(covered.has(slug)).toBe(true);
    }
  });

  it("has no Mobile Legends preset in this phase", () => {
    expect(getGamePresetById("mobile-legends")).toBeUndefined();
    expect(
      GAME_PRESETS.some(
        (preset) =>
          (preset.gameSlug as string) === "mobile-legends" ||
          preset.label.toLowerCase().includes("mobile legends")
      )
    ).toBe(false);
  });

  it("leaves existing ranked presets unchanged", () => {
    expect(RANKED_PRESETS.map((p) => p.id)).toEqual([
      "top3",
      "top4",
      "top5",
      "top8",
      "top10",
    ]);
  });
});
