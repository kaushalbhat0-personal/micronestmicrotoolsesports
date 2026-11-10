import { describe, expect, it } from "vitest";
import {
  TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS,
  TOURNAMENT_SCENARIO_GENERATOR_TOTAL,
  buildGeneratorResult,
  isGeneratorComplete,
  scoreGeneratorPick,
  summarizeGenerator,
} from "./tournament-scenario-generator-logic";

describe("scenario-generator logic — picks", () => {
  const scenario = TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS[0]!;
  const aligned = scenario.options.find((o) => o.alignsWithOutcome)!;
  const other = scenario.options.find((o) => !o.alignsWithOutcome)!;

  it("scores the outcome-aligned priority exactly once", () => {
    expect(scoreGeneratorPick(scenario, aligned.id, false)).toEqual({ points: 1, stronger: true });
    expect(scoreGeneratorPick(scenario, other.id, false)).toEqual({ points: 0, stronger: false });
  });

  it("fails closed on unknown options and repeat picks", () => {
    expect(scoreGeneratorPick(scenario, "nope", false)).toEqual({ points: 0, stronger: false });
    expect(scoreGeneratorPick(scenario, aligned.id, true)).toEqual({ points: 0, stronger: false });
  });

  it("locks selection after the first pick", () => {
    // alreadyAnswered=true models the island's picked!==null guard.
    for (const s of TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS) {
      for (const o of s.options) {
        expect(scoreGeneratorPick(s, o.id, true)).toEqual({ points: 0, stronger: false });
      }
    }
  });
});

describe("scenario-generator logic — completion", () => {
  it("completes exactly after the last scenario is answered", () => {
    expect(isGeneratorComplete(TOURNAMENT_SCENARIO_GENERATOR_TOTAL - 1)).toBe(false);
    expect(isGeneratorComplete(TOURNAMENT_SCENARIO_GENERATOR_TOTAL)).toBe(true);
    expect(isGeneratorComplete(TOURNAMENT_SCENARIO_GENERATOR_TOTAL + 3)).toBe(true);
  });

  it("builds a deterministic result capped at the bank size", () => {
    expect(buildGeneratorResult(3, 6)).toEqual({ stronger: 3, total: TOURNAMENT_SCENARIO_GENERATOR_TOTAL, completedScenarios: 6 });
    expect(buildGeneratorResult(9, 99)).toEqual({ stronger: 9, total: TOURNAMENT_SCENARIO_GENERATOR_TOTAL, completedScenarios: TOURNAMENT_SCENARIO_GENERATOR_TOTAL });
  });

  it("restarts cleanly — zero answered means incomplete", () => {
    expect(isGeneratorComplete(0)).toBe(false);
  });
});

describe("scenario-generator logic — summary honesty", () => {
  it("says exactly what the number counts, with no skill semantics", () => {
    for (const n of [0, 3, 6]) {
      const summary = summarizeGenerator(n);
      expect(summary.total).toBe(TOURNAMENT_SCENARIO_GENERATOR_TOTAL);
      expect(summary.stronger).toBe(n);
      expect(summary.heading.length).toBeGreaterThan(0);
      expect(summary.body).toContain(`${n} of ${TOURNAMENT_SCENARIO_GENERATOR_TOTAL}`);
    }
    const copy = [0, 1, 2, 3, 4, 5, 6].map((n) => `${summarizeGenerator(n).heading} ${summarizeGenerator(n).body}`).join("\n");
    // Denials ("not correctness", "not skill") are required honesty —
    // ban only affirmative skill/prediction semantics.
    for (const banned of [/skill rating/i, /rates your skill/i, /IGL grade/i, /accuracy/i, /predict/i, /percentile/i, /leaderboard/i, /you were right/i, /you were wrong/i]) {
      expect(copy).not.toMatch(banned);
    }
  });

  it("is deterministic for the same input", () => {
    expect(summarizeGenerator(5)).toEqual(summarizeGenerator(5));
  });

  it("covers the full bank — every scenario contributes to the total", () => {
    expect(TOURNAMENT_SCENARIO_GENERATOR_TOTAL).toBe(TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS.length);
  });
});
