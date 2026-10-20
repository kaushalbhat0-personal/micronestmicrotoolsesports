import { describe, expect, it } from "vitest";
import {
  ROTATION_REPLAY_SCENARIOS,
  ROTATION_REPLAY_TOTAL,
  buildReplayResult,
  isReplayComplete,
  scoreReplayPick,
  summarizeReplay,
} from "./rotation-replay-logic";

describe("rotation-replay logic — picks", () => {
  const scenario = ROTATION_REPLAY_SCENARIOS[0]!;
  const aligned = scenario.options.find((o) => o.alignsWithOutcome)!;
  const other = scenario.options.find((o) => !o.alignsWithOutcome)!;

  it("scores the outcome-aligned priority exactly once", () => {
    expect(scoreReplayPick(scenario, aligned.id, false)).toEqual({ points: 1, linedUp: true });
    expect(scoreReplayPick(scenario, other.id, false)).toEqual({ points: 0, linedUp: false });
  });

  it("fails closed on unknown options and repeat picks", () => {
    expect(scoreReplayPick(scenario, "nope", false)).toEqual({ points: 0, linedUp: false });
    expect(scoreReplayPick(scenario, aligned.id, true)).toEqual({ points: 0, linedUp: false });
  });
});

describe("rotation-replay logic — completion", () => {
  it("completes exactly after the last scenario is answered", () => {
    expect(isReplayComplete(ROTATION_REPLAY_TOTAL - 1)).toBe(false);
    expect(isReplayComplete(ROTATION_REPLAY_TOTAL)).toBe(true);
    expect(isReplayComplete(ROTATION_REPLAY_TOTAL + 3)).toBe(true);
  });

  it("builds a deterministic result capped at the bank size", () => {
    expect(buildReplayResult(3, 5)).toEqual({ linedUp: 3, total: ROTATION_REPLAY_TOTAL, completedScenarios: 5 });
    expect(buildReplayResult(9, 99)).toEqual({ linedUp: 9, total: ROTATION_REPLAY_TOTAL, completedScenarios: ROTATION_REPLAY_TOTAL });
  });
});

describe("rotation-replay logic — summary honesty", () => {
  it("says exactly what the number counts, with no skill semantics", () => {
    for (const n of [0, 2, 5]) {
      const summary = summarizeReplay(n);
      expect(summary.total).toBe(ROTATION_REPLAY_TOTAL);
      expect(summary.linedUp).toBe(n);
      expect(summary.heading.length).toBeGreaterThan(0);
      expect(summary.body).toContain(`${n} of ${ROTATION_REPLAY_TOTAL}`);
    }
    const copy = [0, 1, 2, 3, 4, 5].map((n) => `${summarizeReplay(n).heading} ${summarizeReplay(n).body}`).join("\n");
    // Denials ("not skill", "never a skill rating") are required honesty —
    // ban only affirmative skill/prediction semantics.
    for (const banned of [/skill rating/i, /rates your skill/i, /IGL grade/i, /accuracy/i, /predict/i, /percentile/i, /leaderboard/i]) {
      expect(copy).not.toMatch(banned);
    }
  });

  it("is deterministic for the same input", () => {
    expect(summarizeReplay(4)).toEqual(summarizeReplay(4));
  });

  it("covers the full bank — every scenario contributes to the total", () => {
    expect(ROTATION_REPLAY_TOTAL).toBe(ROTATION_REPLAY_SCENARIOS.length);
  });
});
