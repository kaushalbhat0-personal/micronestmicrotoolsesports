import type { RuleId, RuleOrder, RulePresetId } from "./types";

/**
 * Tie-Breaker Resolver — V1 rule presets.
 *
 * Editable starting points only, never external rulebook authority.
 * Exactly three presets. No tournament pairing encoded here.
 */

export const ROUND_ROBIN_ORDER: RuleOrder = ["points", "h2h", "map_diff", "round_diff", "wins"];

export const GROUP_STAGE_ORDER: RuleOrder = ["points", "map_diff", "round_diff", "h2h", "wins"];

export const SWISS_LITE_ORDER: RuleOrder = ["points", "wins", "map_diff", "round_diff", "h2h"];

export const PRESET_LABELS: Record<RulePresetId, string> = {
  round_robin: "Round-robin",
  group_stage: "Group stage",
  swiss_lite: "Standings only",
};

export const PRESET_ORDERS: Record<RulePresetId, RuleOrder> = {
  round_robin: ROUND_ROBIN_ORDER,
  group_stage: GROUP_STAGE_ORDER,
  swiss_lite: SWISS_LITE_ORDER,
};

export function presetOrder(preset: RulePresetId): RuleOrder {
  return PRESET_ORDERS[preset];
}

export const RULE_LABELS: Record<RuleId, string> = {
  points: "Points",
  h2h: "Head-to-head",
  map_diff: "Map difference",
  round_diff: "Round difference",
  wins: "Total wins",
};
