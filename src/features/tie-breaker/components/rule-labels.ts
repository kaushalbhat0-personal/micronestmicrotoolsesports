import type { RuleId, RulePresetId } from "../types";
import { RULE_LABELS } from "../presets";

/**
 * Tie-Breaker Resolver — customer-facing rule wording.
 * Pure display strings only. No ranking logic lives here.
 */

export function ruleLabel(rule: RuleId): string {
  return RULE_LABELS[rule];
}

export function ruleDescription(rule: RuleId, roundLabel: "rounds" | "games" = "rounds"): string {
  switch (rule) {
    case "points":
      return "Total points from wins, draws and losses.";
    case "h2h":
      return "Results between the teams that are still tied.";
    case "map_diff":
      return "Maps won minus maps lost.";
    case "round_diff":
      return roundLabel === "games" ? "Games won minus games lost." : "Rounds won minus rounds lost.";
    case "wins":
      return "Matches won, ignoring draws.";
  }
}

export function presetDescription(preset: RulePresetId): string {
  switch (preset) {
    case "round_robin":
      return "Every team plays every other team. Direct results settle ties first.";
    case "group_stage":
      return "Group play where overall map and round performance settles ties first.";
    case "swiss_lite":
      return "Standings from completed matches only. This tool never pairs rounds.";
  }
}

export function statusLabel(status: "draft" | "active" | "locked"): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "active":
      return "Active";
    case "locked":
      return "Locked";
  }
}

/** "+7", "-2", "0" for differential columns. */
export function formatDiff(value: number): string {
  if (value > 0) return `+${value}`;
  return `${value}`;
}
