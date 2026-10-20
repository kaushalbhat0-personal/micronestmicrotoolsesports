import { describe, expect, it } from "vitest";
import { CIRCLE_IQ_ROUNDS, CIRCLE_IQ_TOTAL } from "./circle-iq-rounds";
import {
  MAP_TAP_THRESHOLD,
  SCOUTS_PER_ROUND,
  buildResult,
  consequenceCopyFor,
  consequenceKindFor,
  createRunSeed,
  createScoutState,
  inspectReveal,
  isComplete,
  isRevealTargetValid,
  orderOptionsForRound,
  orderRoundsForRun,
  resolveMapTap,
  revealIdsFor,
  scorePick,
  scoutNote,
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

/** Pre-commit surfaces must never grade a route. Word-boundary matched. */
const PRE_COMMIT_LEAK = /\b(covered|open|safer|risky|strong|weak|best|better|correct|wrong|optimal|exposed)\b/i;

/** Intel may state terrain facts, but never a verdict, grade, or score. */
const INTEL_VERDICT_LEAK = /\b(correct|wrong|best|strong|weak|safer|riskier|verdict|score|optimal|answer)\b/i;

function preCommitCopy(round: (typeof CIRCLE_IQ_ROUNDS)[number]): string[] {
  return [
    round.title,
    round.situation,
    round.question,
    ...round.landmarks.map((l) => l.label),
    ...round.options.flatMap((o) => [o.label, o.route.caption]),
  ];
}

describe("circle-iq V4 — authored reveal model", () => {
  it("gives every round 3–4 inspectable targets with stable unique ids", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      expect(round.reveals.length).toBeGreaterThanOrEqual(3);
      expect(round.reveals.length).toBeLessThanOrEqual(4);
      const ids = round.reveals.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id.length).toBeGreaterThan(2);
    }
  });

  it("references a real landmark or option target for every reveal", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      for (const reveal of round.reveals) {
        expect(isRevealTargetValid(round, reveal), `${round.id}/${reveal.id} → ${reveal.targetId}`).toBe(true);
      }
      expect(new Set(revealIdsFor(round)).size).toBe(round.reveals.length);
    }
  });

  it("keeps reveal pins inside the 360×240 diagram with concise factual intel", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      for (const reveal of round.reveals) {
        expect(["landmark", "route", "threat"]).toContain(reveal.kind);
        expect(reveal.x).toBeGreaterThanOrEqual(0);
        expect(reveal.x).toBeLessThanOrEqual(360);
        expect(reveal.y).toBeGreaterThanOrEqual(0);
        expect(reveal.y).toBeLessThanOrEqual(240);
        expect(reveal.title.length).toBeGreaterThan(2);
        expect(reveal.intel.length).toBeGreaterThan(20);
      }
    }
  });

  it("never leaks verdict, grade, or score inside scout intel", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      for (const reveal of round.reveals) {
        expect(reveal.intel, `${round.id}/${reveal.id}`).not.toMatch(INTEL_VERDICT_LEAK);
        expect(reveal.title, `${round.id}/${reveal.id}`).not.toMatch(INTEL_VERDICT_LEAK);
      }
    }
  });
});

describe("circle-iq V4 — answer-leak removal (pre-commit surfaces)", () => {
  it("keeps situation, question, labels, captions, and landmark names grade-free", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      for (const copy of preCommitCopy(round)) {
        expect(copy, `${round.id}: ${copy}`).not.toMatch(PRE_COMMIT_LEAK);
      }
    }
  });

  it("keeps every route preview caption to neutral geometry", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      for (const option of round.options) {
        expect(option.route.caption.length).toBeGreaterThan(5);
        expect(option.route.caption, `${round.id}/${option.id}`).not.toMatch(PRE_COMMIT_LEAK);
        expect(option.route.caption).not.toMatch(/guarantee|predict|\bwin\b|surviv\w*|correct|100%/i);
      }
    }
  });
});

describe("circle-iq V4 — scout budget rules", () => {
  it("starts every round with exactly 2 scouts and empty inspections", () => {
    expect(SCOUTS_PER_ROUND).toBe(2);
    expect(createScoutState()).toEqual({ scoutsLeft: 2, inspectedIds: [] });
  });

  it("spends one scout per fresh target and never drops below zero", () => {
    const round = CIRCLE_IQ_ROUNDS[0]!;
    const ids = revealIdsFor(round);
    const state = createScoutState();
    const first = inspectReveal(state, ids[0]!, ids, false);
    expect(first.consumed).toBe(true);
    expect(first.state).toEqual({ scoutsLeft: 1, inspectedIds: [ids[0]] });
    const second = inspectReveal(first.state, ids[1]!, ids, false);
    expect(second.consumed).toBe(true);
    expect(second.state.scoutsLeft).toBe(0);
    const third = inspectReveal(second.state, ids[2]!, ids, false);
    expect(third.consumed).toBe(false);
    expect(third.state.scoutsLeft).toBe(0);
    expect(third.state.inspectedIds).toHaveLength(2);
  });

  it("never lets the same target consume twice", () => {
    const round = CIRCLE_IQ_ROUNDS[0]!;
    const ids = revealIdsFor(round);
    const once = inspectReveal(createScoutState(), ids[0]!, ids, false);
    const twice = inspectReveal(once.state, ids[0]!, ids, false);
    expect(twice.consumed).toBe(false);
    expect(twice.state.scoutsLeft).toBe(1);
  });

  it("fails safely on unknown targets and locked rounds", () => {
    const round = CIRCLE_IQ_ROUNDS[0]!;
    const ids = revealIdsFor(round);
    expect(inspectReveal(createScoutState(), "nope", ids, false).consumed).toBe(false);
    expect(inspectReveal(createScoutState(), ids[0]!, ids, true).consumed).toBe(false);
    expect(createScoutState().scoutsLeft).toBe(SCOUTS_PER_ROUND);
  });

  it("reports scout use as information, never currency", () => {
    expect(scoutNote(0)).toMatch(/cold/i);
    expect(scoutNote(1)).toMatch(/1 of 2/);
    expect(scoutNote(2)).toMatch(/both/i);
    expect(scoutNote(0)).not.toMatch(/point|coin|reward|bonus/i);
  });
});

describe("circle-iq V4 — outcome-differentiated consequences", () => {
  it("maps every option to arrived / caught-open / left-behind", () => {
    let arrived = 0;
    let caught = 0;
    let held = 0;
    for (const round of CIRCLE_IQ_ROUNDS) {
      for (const option of round.options) {
        const kind = consequenceKindFor(option);
        if (option.quality === "strong") {
          expect(kind).toBe("arrived");
          arrived += 1;
        } else if (option.route.style === "hold") {
          expect(kind).toBe("left-behind");
          held += 1;
        } else {
          expect(kind).toBe("caught-open");
          caught += 1;
        }
      }
    }
    expect(arrived).toBe(8);
    expect(caught).toBeGreaterThan(0);
    expect(held).toBeGreaterThan(0);
  });

  it("uses three visibly distinct consequence lines (no shared verdict copy)", () => {
    const lines = new Set<string>();
    for (const round of CIRCLE_IQ_ROUNDS) {
      for (const option of round.options) {
        lines.add(consequenceCopyFor(option).line);
      }
    }
    expect(lines.size).toBe(3);
    const text = [...lines].join(" | ");
    expect(text).toMatch(/tightens on your position/);
    expect(text).toMatch(/closes past you/);
    expect(text).toMatch(/leaves the position behind/);
  });

  it("keeps pre-existing identity and tendency behavior unchanged", () => {
    const round = CIRCLE_IQ_ROUNDS[0]!;
    const strong = round.options.find((o) => o.quality === "strong")!;
    expect(scorePick(round, strong.id, false)).toEqual({ points: 1, isStrong: true });
    expect(tendencyForMisses([])).toBeNull();
  });
});

describe("circle-iq responsive hardening — resolveMapTap", () => {
  const pins = [
    { id: "a", x: 82, y: 170 },
    { id: "b", x: 165, y: 62 },
  ];
  const corridors = [
    { optionId: "north", points: [{ x: 82, y: 170 }, { x: 238, y: 100 }] },
    { optionId: "stay", points: [{ x: 100, y: 180 }, { x: 100, y: 180 }] },
  ];

  it("exposes a documented threshold sized for the smallest map", () => {
    // 360px viewport → ~256px map after in-island padding relief → 0.71
    // scale. 2 × 36 × 0.71 ≈ 51px effective touch diameter ≥ 44px.
    expect(MAP_TAP_THRESHOLD).toBe(36);
    expect(2 * MAP_TAP_THRESHOLD * (256 / 360)).toBeGreaterThanOrEqual(44);
  });

  it("resolves taps to the nearest pin", () => {
    // Exact pin center ties with its corridor at distance 0 → pin wins.
    expect(resolveMapTap(pins, corridors, 82, 170)).toEqual({ kind: "pin", id: "a" });
    expect(resolveMapTap(pins, corridors, 165, 64)).toEqual({ kind: "pin", id: "b" });
  });

  it("resolves taps near a corridor line to that corridor", () => {
    // Midpoint of the north line, offset 10 units perpendicular-ish.
    expect(resolveMapTap([], corridors, 160, 135)).toEqual({ kind: "corridor", optionId: "north" });
  });

  it("resolves hold corridors (degenerate points) by point distance", () => {
    expect(resolveMapTap([], corridors, 102, 182)).toEqual({ kind: "corridor", optionId: "stay" });
  });

  it("returns null past the threshold and on invalid input", () => {
    expect(resolveMapTap(pins, corridors, 5, 5)).toBeNull();
    expect(resolveMapTap([], [], 180, 120)).toBeNull();
    expect(resolveMapTap(pins, corridors, Number.NaN, 120)).toBeNull();
    expect(resolveMapTap(pins, corridors, 84, 168, 0)).toBeNull();
    // Custom thresholds are honored.
    expect(resolveMapTap(pins, corridors, 120, 130, 200)).not.toBeNull();
  });

  it("breaks ties deterministically: pins before corridors, first-in-order", () => {
    const tied = [
      { id: "first", x: 100, y: 100 },
      { id: "second", x: 100, y: 100 },
    ];
    expect(resolveMapTap(tied, [], 100, 100)).toEqual({ kind: "pin", id: "first" });
    const pinOnLine = [{ id: "p", x: 160, y: 135 }];
    expect(resolveMapTap(pinOnLine, corridors, 160, 135)).toEqual({ kind: "pin", id: "p" });
    // Repeated calls agree.
    const once = resolveMapTap(pins, corridors, 120, 120);
    expect(resolveMapTap(pins, corridors, 120, 120)).toEqual(once);
  });

  it("never mutates its inputs", () => {
    const frozenPins = pins.map((p) => ({ ...p }));
    const frozenCorridors = corridors.map((c) => ({ optionId: c.optionId, points: c.points.map((p) => ({ ...p })) }));
    resolveMapTap(frozenPins, frozenCorridors, 120, 120);
    expect(frozenPins).toEqual(pins);
    expect(frozenCorridors).toEqual(corridors);
  });

  it("resolves every authored pin at mobile map scales", () => {
    // Client tap exactly on each pin center, across supported map widths.
    for (const mapWidth of [232, 248, 256, 280, 310, 332]) {
      const mapHeight = (mapWidth * 240) / 360;
      for (const round of CIRCLE_IQ_ROUNDS) {
        const roundPins = round.reveals.map((r) => ({ id: r.id, x: r.x, y: r.y }));
        for (const pin of roundPins) {
          const clientX = (pin.x / 360) * mapWidth;
          const clientY = (pin.y / 240) * mapHeight;
          // Convert back exactly as the island does, then resolve.
          const vx = (clientX / mapWidth) * 360;
          const vy = (clientY / mapHeight) * 240;
          expect(resolveMapTap(roundPins, [], vx, vy)).toEqual({ kind: "pin", id: pin.id });
        }
      }
    }
  });

  it("resolves taps between authored pins deterministically", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      const roundPins = round.reveals.map((r) => ({ id: r.id, x: r.x, y: r.y }));
      if (roundPins.length < 2) continue;
      const a = roundPins[0]!;
      const b = roundPins[1]!;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // Midpoint may be inside both thresholds (nearest wins) or outside
      // both (null) — either way the answer must be stable.
      expect(resolveMapTap(roundPins, [], mid.x, mid.y)).toEqual(resolveMapTap(roundPins, [], mid.x, mid.y));
    }
  });
});
