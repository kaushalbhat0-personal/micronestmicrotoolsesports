import type { CompareResult } from "../types";
import { BEST_CASE_ASSUMPTION } from "./presets";

/**
 * Trust-model verdict copy. Banned words (safe, guaranteed, certain,
 * will qualify, locked) never appear here — enforced by unit test.
 */

export function verdictLabel(result: CompareResult): string {
  switch (result) {
    case "above":
      return "Above target";
    case "exact":
      return "Needs tiebreak";
    case "below":
      return "Below target";
  }
}

/** "You need N more" headline, or target-met copy when gap ≤ 0. */
export function gapMessage(pointsNeeded: number, matchesRemaining: number): string {
  if (pointsNeeded <= 0) {
    return "Target met on points — final position still depends on other results and tiebreaks (WWCDs, then placement, then finishes, then the last match).";
  }
  if (matchesRemaining === 0) {
    return `You need ${pointsNeeded} more point${pointsNeeded === 1 ? "" : "s"} with no matches left — the target is out of reach from here.`;
  }
  return `You need ${pointsNeeded} more point${pointsNeeded === 1 ? "" : "s"} from ${matchesRemaining} match${matchesRemaining === 1 ? "" : "es"}.`;
}

export function rateMessage(rate: number | null): string | null {
  if (rate === null) return null;
  if (rate <= 0) return "No scoring rate needed — you are already at or above target.";
  return `Required average: ${formatRate(rate)} pts per match.`;
}

function formatRate(rate: number): string {
  return Number.isInteger(rate) ? String(rate) : rate.toFixed(1);
}

export function scenarioMessage(
  placement: number,
  finishes: number,
  scenarioTotal: number,
  projected: number,
  target: number,
  result: CompareResult
): string {
  const base = `${ordinal(placement)} + ${finishes} finish${finishes === 1 ? "" : "es"} = +${scenarioTotal} pts → ${projected} projected. `;
  switch (result) {
    case "above":
      return `${base}Projected ${projected} pts — above your ${target}-pt target on current standings.`;
    case "exact":
      return `${base}Target matched — final position may depend on tiebreaks.`;
    case "below": {
      const short = target - projected;
      return `${base}Projected ${projected} pts — ${short} point${short === 1 ? "" : "s"} short of your target.`;
    }
  }
}

export function outOfReachMessage(): string {
  return `Even your best realistic run falls short under the current assumptions (${BEST_CASE_ASSUMPTION}). The target is out of reach from here — focus on placement and finishes to close the gap.`;
}

function ordinal(n: number): string {
  const suffix = n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
  return `${n}${suffix}`;
}
