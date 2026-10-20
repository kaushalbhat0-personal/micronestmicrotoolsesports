import {
  ROTATION_REPLAY_SCENARIOS,
  ROTATION_REPLAY_TOTAL,
  type RotationReplayScenario,
} from "./rotation-replay-scenarios";

/**
 * Rotation Replay pure game logic — no React, no DOM, no persistence.
 * The island component is a thin renderer over these helpers so picks,
 * completion, and interpretation are unit-testable without a browser.
 *
 * SCORING CONTRACT (documented, no skill semantics):
 * a "lined-up read" counts a pick whose priority best describes the recorded
 * outcome profile of that match (see `alignsWithOutcome` in the bank). It
 * measures alignment between the player's stated priority and the published
 * numbers — NOT tactical correctness, NOT IGL skill, NOT prediction.
 * Unknown option ids score 0 (fail-closed); repeat picks earn nothing.
 */

export type { RotationReplayOption, RotationReplayScenario } from "./rotation-replay-scenarios";

export interface RotationReplayPick {
  /** Points earned by this pick: 1 when the priority lines up, 0 otherwise. */
  readonly points: number;
  readonly linedUp: boolean;
}

export function scoreReplayPick(
  scenario: RotationReplayScenario,
  optionId: string,
  alreadyAnswered: boolean
): RotationReplayPick {
  if (alreadyAnswered) return { points: 0, linedUp: false };
  const option = scenario.options.find((o) => o.id === optionId);
  if (!option) return { points: 0, linedUp: false };
  return option.alignsWithOutcome ? { points: 1, linedUp: true } : { points: 0, linedUp: false };
}

/** Completion occurs exactly after the last scenario is answered. */
export function isReplayComplete(answeredCount: number): boolean {
  return answeredCount >= ROTATION_REPLAY_TOTAL;
}

export interface RotationReplaySummary {
  readonly linedUp: number;
  readonly total: number;
  readonly heading: string;
  readonly body: string;
}

/**
 * Completion interpretation — viewing feedback, never a skill rating.
 * Deliberately non-authoritative: no percentiles, no IGL grades, no
 * prediction claims. Says what the number counts, every time.
 */
export function summarizeReplay(linedUp: number): RotationReplaySummary {
  const total = ROTATION_REPLAY_TOTAL;
  if (linedUp >= 4) {
    return {
      linedUp,
      total,
      heading: "Locked into the lobby",
      body: `Your priorities lined up with the recorded outcome in ${linedUp} of ${total} replays. That measures alignment with what happened — not correctness, and not what any team intended.`,
    };
  }
  if (linedUp >= 2) {
    return {
      linedUp,
      total,
      heading: "Mixed reads",
      body: `Your priorities lined up in ${linedUp} of ${total} replays. Re-read the recorded outcomes: the numbers reward different priorities on different days and maps.`,
    };
  }
  return {
    linedUp,
    total,
    heading: "Different wavelength",
    body: `Your priorities lined up in ${linedUp} of ${total} replays. That is fine — the score counts alignment with recorded outcomes, not skill. The takeaways carry the transferable part.`,
  };
}

export interface RotationReplayResult {
  readonly linedUp: number;
  readonly total: number;
  readonly completedScenarios: number;
}

export function buildReplayResult(linedUp: number, answeredCount: number): RotationReplayResult {
  return {
    linedUp,
    total: ROTATION_REPLAY_TOTAL,
    completedScenarios: Math.min(answeredCount, ROTATION_REPLAY_TOTAL),
  };
}

export { ROTATION_REPLAY_SCENARIOS, ROTATION_REPLAY_TOTAL };
