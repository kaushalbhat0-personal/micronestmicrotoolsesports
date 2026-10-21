import { describe, expect, it } from "vitest";
import { IGL_DECISION_SCENARIOS, IGL_DECISION_TOTAL, getIglDecisionScenario } from "./igl-decision-scenarios";

/** Banned in authored IGL content: certainty, prediction, and ranking language. */
const BANNED = [
  /\bcorrect\b/i,
  /\bincorrect\b/i,
  /\balways\b/i,
  /\bbest play\b/i,
  /\bpredict\w*\b/i,
  /\bprediction\b/i,
  /\baccuracy\b/i,
  /\bpercentile\b/i,
  /\bleaderboard\b/i,
  /\bIGL rating\b/i,
  /\bskill rating\b/i,
  /\brating\b/i,
  /\bgrade\b/i,
  /\bguarantee\w*\b/i,
] as const;

function allCopy(): string[] {
  return IGL_DECISION_SCENARIOS.flatMap((s) => [
    s.title,
    s.situation,
    s.question,
    s.principle,
    s.uncertainty,
    s.brief.remainingTeams,
    s.brief.position,
    s.brief.terrain,
    s.brief.zone,
    s.brief.resources,
    s.brief.threats,
    s.brief.timing,
    ...s.intel.flatMap((i) => [i.title, i.body]),
    ...s.options.flatMap((o) => [o.label, o.rationale ?? "", o.weakerBecause ?? "", o.consequence]),
  ]);
}

describe("igl-decision scenarios — bank shape", () => {
  it("ships exactly 6 authored synthetic scenarios with matching total", () => {
    expect(IGL_DECISION_SCENARIOS).toHaveLength(6);
    expect(IGL_DECISION_TOTAL).toBe(6);
    expect(IGL_DECISION_TOTAL).toBe(IGL_DECISION_SCENARIOS.length);
  });

  it("resolves scenarios by id and returns null for unknown ids", () => {
    const scenario = getIglDecisionScenario("third-party-trap")!;
    expect(scenario.title).toBe("The third-party trap");
    expect(scenario.options).toHaveLength(3);
    expect(getIglDecisionScenario("nope")).toBeNull();
  });

  it("uses unique scenario, intel, and option ids", () => {
    const scenarioIds = IGL_DECISION_SCENARIOS.map((s) => s.id);
    expect(new Set(scenarioIds).size).toBe(scenarioIds.length);
    for (const s of IGL_DECISION_SCENARIOS) {
      const intelIds = s.intel.map((i) => i.id);
      expect(new Set(intelIds).size).toBe(intelIds.length);
      const optionIds = s.options.map((o) => o.id);
      expect(new Set(optionIds).size).toBe(optionIds.length);
      for (const id of [...intelIds, ...optionIds]) {
        expect(id.length).toBeGreaterThan(0);
      }
    }
  });

  it("carries a complete seven-field tactical brief per scenario", () => {
    for (const s of IGL_DECISION_SCENARIOS) {
      for (const field of [
        s.brief.remainingTeams,
        s.brief.position,
        s.brief.terrain,
        s.brief.zone,
        s.brief.resources,
        s.brief.threats,
        s.brief.timing,
      ]) {
        expect(field.length).toBeGreaterThan(0);
      }
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.situation.length).toBeGreaterThan(40);
      expect(s.question.length).toBeGreaterThan(0);
      expect(s.principle.length).toBeGreaterThan(20);
      expect(s.uncertainty.length).toBeGreaterThan(20);
    }
  });

  it("offers 2–3 calls with exactly one stronger call each", () => {
    for (const s of IGL_DECISION_SCENARIOS) {
      expect(s.options.length).toBeGreaterThanOrEqual(2);
      expect(s.options.length).toBeLessThanOrEqual(3);
      expect(s.options.filter((o) => o.quality === "strong")).toHaveLength(1);
    }
  });

  it("gives every option an explicit decision family from the call set", () => {
    const families = new Set(["fight", "avoid", "hold", "rotate"]);
    const seen = new Set<string>();
    for (const s of IGL_DECISION_SCENARIOS) {
      for (const o of s.options) {
        expect(families.has(o.family)).toBe(true);
        seen.add(o.family);
      }
    }
    // The bank exercises every family — no dead tendency branch.
    expect([...seen].sort()).toEqual(["avoid", "fight", "hold", "rotate"]);
  });

  it("caps intel at two free facts per scenario", () => {
    for (const s of IGL_DECISION_SCENARIOS) {
      expect(s.intel.length).toBeGreaterThanOrEqual(1);
      expect(s.intel.length).toBeLessThanOrEqual(2);
      for (const i of s.intel) {
        expect(i.title.length).toBeGreaterThan(0);
        expect(i.body.length).toBeGreaterThan(20);
      }
    }
  });

  it("pairs every weak call with weakerBecause and the strong call with rationale", () => {
    for (const s of IGL_DECISION_SCENARIOS) {
      for (const o of s.options) {
        if (o.quality === "weak") {
          expect(o.weakerBecause?.length ?? 0).toBeGreaterThan(20);
        } else {
          expect(o.rationale?.length ?? 0).toBeGreaterThan(20);
        }
        expect(o.consequence.length).toBeGreaterThan(20);
      }
    }
  });
});

describe("igl-decision scenarios — language contract", () => {
  it("never claims certainty, prediction, or ranking", () => {
    for (const text of allCopy()) {
      for (const banned of BANNED) {
        expect(text, `banned ${banned} in: ${text.slice(0, 80)}`).not.toMatch(banned);
      }
    }
  });

  it("keeps intel free of verdict language", () => {
    for (const s of IGL_DECISION_SCENARIOS) {
      for (const i of s.intel) {
        expect(i.body).not.toMatch(/stronger call|riskier call|should pick|the answer|pick this|choose this/i);
      }
    }
  });

  it("keeps every weak call genuinely plausible with a stated upside", () => {
    for (const s of IGL_DECISION_SCENARIOS) {
      for (const o of s.options) {
        if (o.quality !== "weak" || !o.weakerBecause) continue;
        // weakerBecause must acknowledge an upside before the cost ("but",
        // "though", "sounds", "feels", "appeal", "value", "tempting").
        expect(o.weakerBecause).toMatch(/but|though|sounds|feels|appeal|value|tempting/i);
      }
    }
  });

  it("avoids giveaway wording and positional tells", () => {
    for (const s of IGL_DECISION_SCENARIOS) {
      const lengths = s.options.map((o) => o.label.length);
      const strong = s.options.find((o) => o.quality === "strong")!;
      const weakAvg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      // No dramatically longer/shorter strong label.
      expect(Math.abs(strong.label.length - weakAvg)).toBeLessThan(60);
    }
    // The stronger call is not parked in one slot across the bank.
    const positions = IGL_DECISION_SCENARIOS.map((s) => s.options.findIndex((o) => o.quality === "strong"));
    expect(new Set(positions).size).toBeGreaterThan(1);
  });
});
