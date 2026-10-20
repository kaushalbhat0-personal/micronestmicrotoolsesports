import { describe, expect, it } from "vitest";
import { CIRCLE_IQ_ROUNDS, CIRCLE_IQ_TOTAL } from "./circle-iq-rounds";
import {
  buildResult,
  createRunSeed,
  isComplete,
  orderOptionsForRound,
  orderRoundsForRun,
  scorePick,
  summarizeScore,
  tendencyForMisses,
  tendencyLine,
} from "./circle-iq-logic";

const BANNED = [/predict.*(zone|circle)/i, /guarantee/i, /100%/i, /95%\s*accura/i, /\balways\b/i, /best every time/i];

function allCopy(): string[] {
  return CIRCLE_IQ_ROUNDS.flatMap((r) => [
    r.title,
    r.situation,
    r.question,
    r.principle,
    ...r.options.flatMap((o) => [o.label, o.explanation]),
  ]);
}

describe("circle-iq rounds — authored content contract", () => {
  it("contains exactly 8 rounds with unique ids", () => {
    expect(CIRCLE_IQ_TOTAL).toBe(8);
    expect(CIRCLE_IQ_ROUNDS).toHaveLength(8);
    const ids = CIRCLE_IQ_ROUNDS.map((r) => r.id);
    expect(new Set(ids).size).toBe(8);
  });

  it("gives every round 2–3 options with exactly one strong answer", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      expect(round.options.length).toBeGreaterThanOrEqual(2);
      expect(round.options.length).toBeLessThanOrEqual(3);
      expect(round.options.filter((o) => o.quality === "strong")).toHaveLength(1);
      const optionIds = round.options.map((o) => o.id);
      expect(new Set(optionIds).size).toBe(optionIds.length);
    }
  });

  it("provides explanation, principle, situation, and question for every round", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      expect(round.situation.length).toBeGreaterThan(40);
      expect(round.question.length).toBeGreaterThan(10);
      expect(round.principle.length).toBeGreaterThan(20);
      for (const option of round.options) {
        expect(option.label.length).toBeGreaterThan(5);
        expect(option.explanation.length).toBeGreaterThan(40);
      }
      expect(round.landmarks.length).toBeGreaterThan(0);
    }
  });

  it("keeps coordinates inside the 360×240 diagram space", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      for (const point of [round.zone.center, round.next.center, round.player]) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(360);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(240);
      }
      expect(round.zone.radius).toBeGreaterThan(round.next.radius);
      for (const landmark of round.landmarks) {
        expect(landmark.x).toBeGreaterThanOrEqual(0);
        expect(landmark.x).toBeLessThanOrEqual(360);
        expect(landmark.y).toBeGreaterThanOrEqual(0);
        expect(landmark.y).toBeLessThanOrEqual(240);
      }
    }
  });

  it("makes no prediction, guarantee, or absolute claims", () => {
    for (const copy of allCopy()) {
      for (const banned of BANNED) {
        expect(copy).not.toMatch(banned);
      }
    }
  });

  it("hedges principles as heuristics, not laws", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      expect(round.principle).toMatch(/often|usually|can|tends to|when|check/i);
    }
  });
});

describe("circle-iq logic — pure scoring", () => {
  it("scores strong picks once and weak picks zero", () => {
    const round = CIRCLE_IQ_ROUNDS[0]!;
    const strong = round.options.find((o) => o.quality === "strong")!;
    const weak = round.options.find((o) => o.quality === "weak")!;
    expect(scorePick(round, strong.id, false)).toEqual({ points: 1, isStrong: true });
    expect(scorePick(round, weak.id, false)).toEqual({ points: 0, isStrong: false });
  });

  it("never double-scores: answered rounds and unknown ids earn nothing", () => {
    const round = CIRCLE_IQ_ROUNDS[0]!;
    const strong = round.options.find((o) => o.quality === "strong")!;
    expect(scorePick(round, strong.id, true)).toEqual({ points: 0, isStrong: false });
    expect(scorePick(round, "nope", false)).toEqual({ points: 0, isStrong: false });
  });

  it("resolves every option of every round without crashing", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      for (const option of round.options) {
        const result = scorePick(round, option.id, false);
        expect(result.points).toBe(option.quality === "strong" ? 1 : 0);
      }
    }
  });

  it("completes exactly after 8 answered rounds", () => {
    expect(isComplete(7)).toBe(false);
    expect(isComplete(8)).toBe(true);
    expect(buildResult(6, 8)).toEqual({ score: 6, total: 8, completedRounds: 8 });
  });

  it("summarizes without skill-rating claims", () => {
    for (const score of [0, 3, 5, 6, 8]) {
      const summary = summarizeScore(score);
      expect(summary.score).toBe(score);
      expect(summary.total).toBe(8);
      const text = `${summary.heading} ${summary.body}`;
      expect(text).not.toMatch(/better than|percent|IGL|excellent player/i);
    }
    expect(summarizeScore(8).heading).toBe("Strong reads");
    expect(summarizeScore(5).heading).toBe("Good foundation");
    expect(summarizeScore(2).heading).toBe("Warming up");
  });
});

describe("circle-iq routes — overlay contract (V3)", () => {
  it("gives every option a valid route overlay", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      for (const option of round.options) {
        expect(["covered", "open", "hold"]).toContain(option.route.style);
        expect(option.route.caption.length).toBeGreaterThan(5);
        for (const point of option.route.points) {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(360);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThanOrEqual(240);
        }
        if (option.route.style !== "hold") {
          expect(option.route.points.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it("keeps route captions honest — no result or prediction claims", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      for (const option of round.options) {
        expect(option.route.caption).not.toMatch(/guarantee|predict|\bwin\b|surviv\w*|correct|100%/i);
      }
    }
  });
});

describe("circle-iq seeded shuffle — replay variation (V3)", () => {
  it("creates uint32 run seeds", () => {
    for (const seed of [createRunSeed(), createRunSeed()]) {
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("orders rounds deterministically: same seed → same order, all 8 exactly once", () => {
    const a = orderRoundsForRun(CIRCLE_IQ_ROUNDS, 42).map((r) => r.id);
    const b = orderRoundsForRun(CIRCLE_IQ_ROUNDS, 42).map((r) => r.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(8);
    expect([...a].sort()).toEqual([...CIRCLE_IQ_ROUNDS.map((r) => r.id)].sort());
  });

  it("produces different round orders across seeds", () => {
    const orders = new Set(
      Array.from({ length: 20 }, (_, i) => orderRoundsForRun(CIRCLE_IQ_ROUNDS, i + 1).map((r) => r.id).join(","))
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("orders options deterministically without mutating authored data", () => {
    const round = CIRCLE_IQ_ROUNDS[0]!;
    const before = round.options.map((o) => o.id);
    const a = orderOptionsForRound(round, 7, 0).map((o) => o.id);
    const b = orderOptionsForRound(round, 7, 0).map((o) => o.id);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual([...before].sort());
    expect(round.options.map((o) => o.id)).toEqual(before);
  });

  it("scores by option id regardless of display position", () => {
    for (let seed = 1; seed <= 10; seed++) {
      for (let index = 0; index < CIRCLE_IQ_ROUNDS.length; index++) {
        const round = CIRCLE_IQ_ROUNDS[index]!;
        for (const option of orderOptionsForRound(round, seed, index)) {
          const result = scorePick(round, option.id, false);
          expect(result.points).toBe(option.quality === "strong" ? 1 : 0);
        }
      }
    }
  });

  it("never renders all eight strong answers as A across the tested seed set", () => {
    const positions = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      for (let index = 0; index < CIRCLE_IQ_ROUNDS.length; index++) {
        const round = CIRCLE_IQ_ROUNDS[index]!;
        const displayed = orderOptionsForRound(round, seed, index);
        positions.add(displayed.findIndex((o) => o.quality === "strong"));
      }
    }
    // 8 rounds × 20 seeds = 160 placements; A-only would be size 1 with just 0.
    expect(positions.has(0)).toBe(true);
    expect(positions.size).toBeGreaterThan(1);
    expect(positions.has(1)).toBe(true);
    expect(positions.has(2)).toBe(true);
  });

  it("lets the strong answer of every 3-option round reach A, B, and C", () => {
    for (const round of CIRCLE_IQ_ROUNDS.filter((r) => r.options.length === 3)) {
      const seen = new Set<number>();
      for (let seed = 1; seed <= 30; seed++) {
        for (let index = 0; index < 8; index++) {
          seen.add(orderOptionsForRound(round, seed, index).findIndex((o) => o.quality === "strong"));
        }
      }
      expect(seen).toEqual(new Set([0, 1, 2]));
    }
  });
});

describe("circle-iq tendency — honest run mirror (V3)", () => {
  it("reports null on a perfect run — no invented weakness", () => {
    expect(tendencyForMisses([])).toBeNull();
    expect(tendencyLine(null)).toMatch(/early positioning and protected routes/);
  });

  it("detects hold, open, and contested tendencies by authored ids", () => {
    expect(tendencyForMisses(["hold-compound", "hold-ditch"])).toBe("hold");
    expect(tendencyForMisses(["field-short", "middle-late"])).toBe("open");
    expect(tendencyForMisses(["contest-north", "fight-east"])).toBe("contested");
    expect(tendencyForMisses(["hold-compound", "field-short"])).toBe("mixed");
  });

  it("keeps tendency lines free of ratings and guarantees", () => {
    for (const t of ["hold", "open", "contested", "mixed"] as const) {
      expect(tendencyLine(t)).not.toMatch(/IGL|rating|score|percent|guarantee|always/i);
    }
  });
});
