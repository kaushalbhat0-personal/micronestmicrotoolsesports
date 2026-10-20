import {
  TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS,
  TOURNAMENT_SCENARIO_GENERATOR_TOTAL,
  type TournamentGeneratorScenario,
} from "./tournament-scenario-generator-scenarios";

/**
 * Tournament Scenario Generator pure game logic — no React, no DOM, no
 * persistence. The island component is a thin renderer over these helpers so
 * picks, completion, and interpretation are unit-testable without a browser.
 *
 * SCORING CONTRACT (documented, no skill semantics):
 * a "stronger practice read" counts a pick whose priority best describes the
 * recorded outcome profile of that match (see `alignsWithOutcome` in the
 * bank). It measures alignment between the player's stated priority and the
 * published numbers — NOT tactical correctness, NOT IGL skill, NOT
 * prediction. Unknown option ids score 0 (fail-closed); repeat picks earn
 * nothing.
 */

export type { TournamentGeneratorOption, TournamentGeneratorScenario } from "./tournament-scenario-generator-scenarios";

export interface TournamentGeneratorPick {
  /** Points earned by this pick: 1 when the priority lines up, 0 otherwise. */
  readonly points: number;
  readonly stronger: boolean;
}

export function scoreGeneratorPick(
  scenario: TournamentGeneratorScenario,
  optionId: string,
  alreadyAnswered: boolean
): TournamentGeneratorPick {
  if (alreadyAnswered) return { points: 0, stronger: false };
  const option = scenario.options.find((o) => o.id === optionId);
  if (!option) return { points: 0, stronger: false };
  return option.alignsWithOutcome ? { points: 1, stronger: true } : { points: 0, stronger: false };
}

/** Completion occurs exactly after the last scenario is answered. */
export function isGeneratorComplete(answeredCount: number): boolean {
  return answeredCount >= TOURNAMENT_SCENARIO_GENERATOR_TOTAL;
}

export interface TournamentGeneratorSummary {
  readonly stronger: number;
  readonly total: number;
  readonly heading: string;
  readonly body: string;
}

/**
 * Completion interpretation — viewing feedback, never a skill rating.
 * Deliberately non-authoritative: no percentiles, no IGL grades, no
 * prediction claims. Says what the number counts, every time.
 */
export function summarizeGenerator(stronger: number): TournamentGeneratorSummary {
  const total = TOURNAMENT_SCENARIO_GENERATOR_TOTAL;
  if (stronger >= 5) {
    return {
      stronger,
      total,
      heading: "Strong sequence",
      body: `Your calls lined up with the recorded outcome in ${stronger} of ${total} scenarios. That measures alignment with what happened — not correctness, and not what any team intended.`,
    };
  }
  if (stronger >= 3) {
    return {
      stronger,
      total,
      heading: "Mixed reads",
      body: `Your calls lined up in ${stronger} of ${total} scenarios. Re-read the recorded outcomes: the numbers reward different priorities on different days and maps.`,
    };
  }
  return {
    stronger,
    total,
    heading: "Different wavelength",
    body: `Your calls lined up in ${stronger} of ${total} scenarios. That is fine — the count tracks alignment with recorded outcomes, not skill. The takeaways carry the transferable part.`,
  };
}

export interface TournamentGeneratorResult {
  readonly stronger: number;
  readonly total: number;
  readonly completedScenarios: number;
}

export function buildGeneratorResult(stronger: number, answeredCount: number): TournamentGeneratorResult {
  return {
    stronger,
    total: TOURNAMENT_SCENARIO_GENERATOR_TOTAL,
    completedScenarios: Math.min(answeredCount, TOURNAMENT_SCENARIO_GENERATOR_TOTAL),
  };
}

export { TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS, TOURNAMENT_SCENARIO_GENERATOR_TOTAL };
