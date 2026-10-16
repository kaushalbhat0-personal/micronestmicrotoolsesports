import type { ScoringPreset } from "../types";

/**
 * Tournament scoring presets.
 *
 * V1 ships exactly one preset: the verified KRAFTON 2026 official table
 * (BMSD 2026 Official Competition Rulebook v1.0.0 §14.1 — placement +
 * 1 point per finish; tiebreaks WWCD → placement → finishes → last match).
 * Third-party BGIS/BMPS stage cutoffs are deliberately NOT encoded as
 * presets — uncertain figures must never ship as canonical data.
 * Adding a preset later is a data-only change to PRESETS.
 */
export const KRAFTON_2026_PRESET: ScoringPreset = {
  id: "krafton-2026",
  label: "KRAFTON 2026",
  placementPoints: [10, 6, 5, 4, 3, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  finishPointValue: 1,
  maxPlacement: 16,
  maxFinishesPerMatch: 31,
  sourceLabel: "BMSD 2026 Official Competition Rulebook v1.0.0 §14 — shared across 2026 KRAFTON majors",
};

export const QUALIFICATION_PRESETS: readonly ScoringPreset[] = [KRAFTON_2026_PRESET];

export function getPresetById(id: string): ScoringPreset {
  return QUALIFICATION_PRESETS.find((p) => p.id === id) ?? KRAFTON_2026_PRESET;
}

/**
 * Planning-band assumptions (labeled in UI, never presented as guarantees).
 * Best: win every remaining match with 10 finishes. Worst: early exit
 * every match with ~2 finishes. Both are assumptions, not predictions.
 */
export const BEST_CASE_POINTS_PER_MATCH = 20;
export const WORST_CASE_POINTS_PER_MATCH = 2;
export const BEST_CASE_ASSUMPTION = "assumes a win with 10 finishes every remaining match";
export const WORST_CASE_ASSUMPTION = "assumes an early exit with about 2 finishes every remaining match";
