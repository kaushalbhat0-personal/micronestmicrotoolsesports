/**
 * Loot Dash theme — BGMI flavor copy and palette for abstract mechanics.
 *
 * The simulation (`loot-dash-sim.ts`) knows only: player, token kinds
 * (supply/cache/medkit), hazard, arena, combo. Every display word and color
 * lives here, so a future MLBB skin ("jungle resources", "ability zones",
 * "farming route") remaps this file without touching mechanics.
 *
 * Copy rules (Lab-wide): no skill ratings, no competitive claims, no
 * prediction language. Results are personal practice feedback.
 */

import type { LootDashSummary, LootPickupKind } from "./loot-dash-sim";

export interface LootDashTheme {
  readonly playerLabel: string;
  readonly tokenLabel: Record<LootPickupKind, string>;
  readonly hazardLabel: string;
  readonly gradeHeading: Record<"clean" | "steady" | "messy", string>;
  readonly gradeLine: Record<"clean" | "steady" | "messy", string>;
}

export const LOOT_DASH_BGMI_THEME: LootDashTheme = {
  playerLabel: "YOU",
  tokenLabel: {
    supply: "supply",
    cache: "cache",
    medkit: "medkit",
  },
  hazardLabel: "danger ring",
  gradeHeading: {
    clean: "CLEAN RUN",
    steady: "STEADY RUN",
    messy: "MESSY RUN",
  },
  gradeLine: {
    clean: "Good control through a crowded route.",
    steady: "Solid looting with room to tighten the movement.",
    messy: "You collected well, but gave away too much movement.",
  },
};

export type LootGrade = "clean" | "steady" | "messy";

export function gradeLootRun(summary: LootDashSummary): LootGrade {
  if (summary.reason === "caught") return "messy";
  if (summary.hitsTaken === 0 && summary.pickups >= 12) return "clean";
  if (summary.hitsTaken <= 1 && summary.pickups >= 6) return "steady";
  return "messy";
}

/** Canvas palette drawn from the MicroNest light tokens (no neon, no art). */
export const LOOT_DASH_PALETTE = {
  arena: "#f5f3ee",
  arenaEdge: "#cfc7b8",
  grid: "#e7e1d4",
  player: "#d9681e",
  playerInk: "#8f4a12",
  supply: "#4d7a9e",
  supplyDeep: "#33566f",
  cache: "#8f4a12",
  cacheDeep: "#6e3a0d",
  medkit: "#2e7d4f",
  hazard: "#d0442e",
  hazardSoft: "#e08a7a",
  text: "#6f675c",
  patchA: "#ece4d3",
  patchB: "#e3d9c2",
  patchC: "#f0e9da",
  contour: "#d8cdb6",
  coverWall: "#ded4bd",
  coverEdge: "#8a7a5f",
  coverRock: "#c9bda6",
  coverBush: "#7d8f6a",
  coverBushEdge: "#55663f",
  comboHot: "#b33a1f",
} as const;
