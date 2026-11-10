import type { GameSlug } from "@/config/games/catalog";
import type { DistributionMethod, PlacementInput } from "./index";

/**
 * Official/product game preset — Phase 2 of the game-preset architecture.
 *
 * A game preset is a convenient STARTING configuration only:
 * - Selecting one copies its placements into the existing editable state.
 * - Values stay fully editable, are never locked, persisted, or metered.
 * - The game is UI/configuration context. It is NOT stored in share state,
 *   NOT added to CSV output, and NEVER used for authorization or quotas.
 *
 * Every preset's placements MUST total exactly 100% so the existing
 * `validateInput` passes without modification.
 */
export interface GamePrizePreset {
  readonly id: string;
  readonly gameSlug: GameSlug;
  readonly label: string;
  readonly method: DistributionMethod;
  readonly placements: readonly PlacementInput[];
  readonly sourceNote?: string;
}

export const GAME_PRESETS: readonly GamePrizePreset[] = [
  {
    id: "cs2-major",
    gameSlug: "cs2",
    label: "CS2 Major-style distribution",
    method: "percentage",
    placements: [
      { label: "1st", percentage: 30 },
      { label: "2nd", percentage: 20 },
      { label: "3rd", percentage: 12 },
      { label: "4th", percentage: 10 },
      { label: "5th", percentage: 8 },
      { label: "6th", percentage: 7 },
      { label: "7th", percentage: 7 },
      { label: "8th", percentage: 6 },
    ],
    sourceNote: "Competitive convention — Major-style top-8 distribution.",
  },
  {
    id: "valorant-vct",
    gameSlug: "valorant",
    label: "VCT-style distribution",
    method: "percentage",
    placements: [
      { label: "1st", percentage: 40 },
      { label: "2nd", percentage: 25 },
      { label: "3rd", percentage: 20 },
      { label: "4th", percentage: 15 },
    ],
    sourceNote: "Product default — based on VCT 2026 event distributions.",
  },
  {
    id: "lol-worlds",
    gameSlug: "league-of-legends",
    label: "Worlds-style distribution",
    method: "percentage",
    placements: [
      { label: "1st", percentage: 23.12 },
      { label: "2nd", percentage: 18.5 },
      { label: "3rd", percentage: 9.25 },
      { label: "4th", percentage: 9.25 },
      { label: "5th", percentage: 6.94 },
      { label: "6th", percentage: 6.94 },
      { label: "7th", percentage: 6.94 },
      { label: "8th", percentage: 6.94 },
      { label: "9th", percentage: 4.05 },
      { label: "10th", percentage: 4.05 },
      { label: "11th", percentage: 4.02 },
    ],
    sourceNote:
      "Competitive convention — normalized to 100% from published Worlds 2025 per-team shares (20/16/8/8/6/6/6/6/3.5/3.5/3.5).",
  },
  {
    id: "dota2-ti",
    gameSlug: "dota-2",
    label: "TI-style distribution",
    method: "percentage",
    placements: [
      { label: "1st", percentage: 35 },
      { label: "2nd", percentage: 20 },
      { label: "3rd", percentage: 12 },
      { label: "4th", percentage: 10 },
      { label: "5th", percentage: 8 },
      { label: "6th", percentage: 6 },
      { label: "7th", percentage: 5 },
      { label: "8th", percentage: 4 },
    ],
    sourceNote: "Product default — anchored on TI distribution structures.",
  },
  {
    id: "r6-invitational",
    gameSlug: "rainbow-six-siege",
    label: "R6 Invitational-style distribution",
    method: "percentage",
    placements: [
      { label: "1st", percentage: 35 },
      { label: "2nd", percentage: 22 },
      { label: "3rd", percentage: 15 },
      { label: "4th", percentage: 12 },
      { label: "5th", percentage: 9 },
      { label: "6th", percentage: 7 },
    ],
    sourceNote: "Product default — based on R6 Invitational event structures.",
  },
  {
    id: "pubg-placement",
    gameSlug: "pubg-mobile",
    label: "Battle-royale placement distribution",
    method: "percentage",
    placements: [
      { label: "1st", percentage: 25 },
      { label: "2nd", percentage: 18 },
      { label: "3rd", percentage: 14 },
      { label: "4th", percentage: 11 },
      { label: "5th", percentage: 9 },
      { label: "6th", percentage: 8 },
      { label: "7th", percentage: 8 },
      { label: "8th", percentage: 7 },
    ],
    sourceNote: "Product default — placement-based battle-royale structure.",
  },
  {
    id: "fortnite-fncs",
    gameSlug: "fortnite",
    label: "FNCS-style distribution",
    method: "percentage",
    placements: [
      { label: "1st", percentage: 35 },
      { label: "2nd", percentage: 20 },
      { label: "3rd", percentage: 15 },
      { label: "4th", percentage: 12 },
      { label: "5th", percentage: 10 },
      { label: "6th", percentage: 8 },
    ],
    sourceNote: "Competitive convention — based on FNCS Major distributions.",
  },
  {
    id: "apex-algs",
    gameSlug: "apex-legends",
    label: "ALGS-style distribution",
    method: "percentage",
    placements: [
      { label: "1st", percentage: 25 },
      { label: "2nd", percentage: 18 },
      { label: "3rd", percentage: 14 },
      { label: "4th", percentage: 11 },
      { label: "5th", percentage: 9 },
      { label: "6th", percentage: 7 },
      { label: "7th", percentage: 6 },
      { label: "8th", percentage: 4 },
      { label: "9th", percentage: 3 },
      { label: "10th", percentage: 3 },
    ],
    sourceNote: "Competitive convention — based on ALGS event distributions.",
  },
  {
    id: "rl-rlcs",
    gameSlug: "rocket-league",
    label: "RLCS-style distribution",
    method: "percentage",
    placements: [
      { label: "1st", percentage: 40 },
      { label: "2nd", percentage: 22 },
      { label: "3rd", percentage: 14 },
      { label: "4th", percentage: 10 },
      { label: "5th", percentage: 8 },
      { label: "6th", percentage: 6 },
    ],
    sourceNote: "Product default — based on RLCS event structures.",
  },
  {
    id: "cod-cdl",
    gameSlug: "call-of-duty",
    label: "CDL-style distribution",
    method: "percentage",
    placements: [
      { label: "1st", percentage: 40 },
      { label: "2nd", percentage: 22 },
      { label: "3rd", percentage: 13 },
      { label: "4th", percentage: 9 },
      { label: "5th", percentage: 6 },
      { label: "6th", percentage: 4 },
      { label: "7th", percentage: 3 },
      { label: "8th", percentage: 3 },
    ],
    sourceNote: "Product default — based on CDL Major event structures.",
  },
];

export function getGamePresetById(id: string): GamePrizePreset | undefined {
  return GAME_PRESETS.find((preset) => preset.id === id);
}

export function getGamePresetsBySlug(slug: GameSlug): GamePrizePreset[] {
  return GAME_PRESETS.filter((preset) => preset.gameSlug === slug);
}
