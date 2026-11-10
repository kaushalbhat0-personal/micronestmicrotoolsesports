import { describe, expect, it } from "vitest";
import {
  buildIglResult,
  isIglComplete,
  scoreIglPick,
  summarizeIgl,
  tendencyForIglMisses,
  tendencyLine,
} from "./igl-decision-logic";
import { IGL_DECISION_SCENARIOS } from "./igl-decision-scenarios";

const FIRST = IGL_DECISION_SCENARIOS[0]!;
const STRONG_ID = FIRST.options.find((o) => o.quality === "strong")!.id;
const WEAK_ID = FIRST.options.find((o) => o.quality === "weak")!.id;

describe("igl-decision logic — scoring", () => {
  it("scores the stronger call 1 and a riskier call 0", () => {
    expect(scoreIglPick(FIRST, STRONG_ID, false)).toEqual({ points: 1, isStrong: true });
    expect(scoreIglPick(FIRST, WEAK_ID, false)).toEqual({ points: 0, isStrong: false });
  });

  it("scores unknown option ids 0 (fail-closed)", () => {
    expect(scoreIglPick(FIRST, "nope", false)).toEqual({ points: 0, isStrong: false });
    expect(scoreIglPick(FIRST, "", false)).toEqual({ points: 0, isStrong: false });
  });

  it("scores repeated picks on an answered scenario 0", () => {
    expect(scoreIglPick(FIRST, STRONG_ID, true)).toEqual({ points: 0, isStrong: false });
  });

  it("completes exactly after the last scenario is answered", () => {
    expect(isIglComplete(5)).toBe(false);
    expect(isIglComplete(6)).toBe(true);
    expect(isIglComplete(7)).toBe(true);
    expect(buildIglResult(4, 6)).toEqual({ strong: 4, total: 6, completedScenarios: 6 });
    expect(buildIglResult(9, 99)).toEqual({ strong: 9, total: 6, completedScenarios: 6 });
  });
});

describe("igl-decision logic — summary bands", () => {
  it("names 5–6 stronger calls composed", () => {
    for (const strong of [5, 6]) {
      const summary = summarizeIgl(strong);
      expect(summary.total).toBe(6);
      expect(summary.heading).toBe("Composed IGL");
      expect(summary.body).toContain(`${strong} of 6`);
    }
  });

  it("names 3–4 stronger calls developing judgment", () => {
    for (const strong of [3, 4]) {
      expect(summarizeIgl(strong).heading).toBe("Developing judgment");
    }
  });

  it("names 0–2 stronger calls warming up", () => {
    for (const strong of [0, 1, 2]) {
      expect(summarizeIgl(strong).heading).toBe("Warming up");
    }
  });

  it("describes alignment with the rationale, never skill or prediction", () => {
    for (const strong of [0, 3, 6]) {
      const body = summarizeIgl(strong).body;
      expect(body).toMatch(/scenario rationale/);
      expect(body).not.toMatch(/skill|rank|predict|percentile|leaderboard|grade|best|correct/i);
    }
  });
});

describe("igl-decision logic — tendency", () => {
  it("returns null on a perfect run", () => {
    expect(tendencyForIglMisses([])).toBeNull();
  });

  it("names the strict-majority family of the riskier calls", () => {
    expect(tendencyForIglMisses(["fight", "fight", "hold"])).toBe("fight");
    expect(tendencyForIglMisses(["avoid", "avoid", "rotate", "fight"])).toBe("avoid");
    expect(tendencyForIglMisses(["hold"])).toBe("hold");
    expect(tendencyForIglMisses(["rotate", "rotate"])).toBe("rotate");
  });

  it("reads ties and spreads as mixed", () => {
    expect(tendencyForIglMisses(["fight", "hold"])).toBe("mixed");
    expect(tendencyForIglMisses(["fight", "avoid", "hold", "rotate"])).toBe("mixed");
  });

  it("writes tendency lines as coaching, never ratings", () => {
    for (const line of [
      tendencyLine("fight"),
      tendencyLine("avoid"),
      tendencyLine("hold"),
      tendencyLine("rotate"),
      tendencyLine("mixed"),
      tendencyLine(null),
    ]) {
      expect(line.length).toBeGreaterThan(20);
      expect(line).not.toMatch(/skill|rank|predict|percentile|leaderboard|grade|best|correct|rating/i);
    }
    expect(tendencyLine(null)).toMatch(/every situation/);
  });
});
