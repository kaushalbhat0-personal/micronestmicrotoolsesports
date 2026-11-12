import { describe, expect, it } from "vitest";
import { CIRCLE_IQ_ROUNDS } from "./circle-iq-rounds";
import {
  CROSSING_CORRIDOR_MAX_DISTANCE,
  CROSSING_PAIR_MIN_DISTANCE,
  CROSSING_SCOUT_MIN_DISTANCE,
  consequenceForCrossing,
  crossingAfterCorridorSwitch,
  crossingCorridorDistance,
  crossingForOption,
  resolveMapTap,
  selectCrossing,
  validateCrossingGeometry,
  type CircleIqCrossing,
  type CircleIqRound,
} from "./circle-iq-logic";

/** §8 banned pre-commit quality language for crossing labels + intel. */
const CROSSING_LEAK = /\b(best|better|strong|safe|safer|risky|riskier|correct|wrong|optimal|exposed|weak|good|bad)\b/i;

/** Intel may state terrain facts, but never a verdict, grade, or score. */
const CROSSING_INTEL_VERDICT = /\b(correct|wrong|best|strong|weak|safer|riskier|verdict|score|optimal|answer)\b/i;

function allCrossings(): Array<{ round: CircleIqRound; optionId: string; crossing: CircleIqCrossing }> {
  return CIRCLE_IQ_ROUNDS.flatMap((round) =>
    round.options.flatMap((option) => (option.crossings ?? []).map((crossing) => ({ round, optionId: option.id, crossing }))),
  );
}

function insideViewBox(x: number, y: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 360 && y >= 0 && y <= 240;
}

describe("circle-iq V5 — crossing data contract", () => {
  it("gives every move option exactly 2 crossings and every hold option none", () => {
    let moveOptions = 0;
    let holdOptions = 0;
    for (const round of CIRCLE_IQ_ROUNDS) {
      for (const option of round.options) {
        if (option.route.style === "hold") {
          holdOptions += 1;
          expect(option.crossings ?? [], `${round.id}/${option.id} (hold) must have no crossings`).toHaveLength(0);
        } else {
          moveOptions += 1;
          expect(option.crossings, `${round.id}/${option.id} must carry crossings`).toBeDefined();
          expect(option.crossings).toHaveLength(2);
        }
      }
    }
    expect(moveOptions).toBeGreaterThan(0);
    expect(holdOptions).toBeGreaterThan(0);
  });

  it("keeps every crossing id unique within its round", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      const ids = round.options.flatMap((o) => (o.crossings ?? []).map((c) => c.id));
      expect(new Set(ids).size, `${round.id} crossing ids`).toBe(ids.length);
      for (const id of ids) expect(id.length).toBeGreaterThan(2);
    }
  });

  it("keeps every crossing pin and arrival inside the 360×240 viewBox", () => {
    for (const { round, crossing } of allCrossings()) {
      expect(insideViewBox(crossing.x, crossing.y), `${round.id}/${crossing.id} pin`).toBe(true);
      expect(insideViewBox(crossing.arrival.x, crossing.arrival.y), `${round.id}/${crossing.id} arrival`).toBe(true);
    }
  });

  it("places every crossing on or near its own parent corridor", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      for (const option of round.options) {
        for (const crossing of option.crossings ?? []) {
          const found = crossingForOption(round, option.id, crossing.id);
          expect(found, `${round.id}/${crossing.id} belongs to ${option.id}`).not.toBeNull();
          expect(found).toBe(crossing);
          // The crossing must not resolve to any other option of the round.
          for (const other of round.options) {
            if (other.id === option.id) continue;
            expect(crossingForOption(round, other.id, crossing.id), `${crossing.id} must not belong to ${other.id}`).toBeNull();
          }
        }
      }
    }
  });

  it("keeps crossing coordinates sensible and separated within a corridor", () => {
    for (const { round, optionId, crossing } of allCrossings()) {
      expect(Number.isFinite(crossing.x)).toBe(true);
      expect(Number.isFinite(crossing.y)).toBe(true);
      expect(crossing.label.length, `${round.id}/${crossing.id} label`).toBeGreaterThan(2);
      expect(crossing.intel.length, `${round.id}/${crossing.id} intel`).toBeGreaterThan(20);
      expect(crossing.note.length, `${round.id}/${crossing.id} note`).toBeGreaterThan(10);
      expect(["low", "high"], `${round.id}/${crossing.id} exposure`).toContain(crossing.exposure);
      void optionId;
    }
    for (const round of CIRCLE_IQ_ROUNDS) {
      for (const option of round.options) {
        const list = option.crossings ?? [];
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const dist = Math.hypot(list[i]!.x - list[j]!.x, list[i]!.y - list[j]!.y);
            expect(dist, `${round.id}/${option.id} crossings overlap`).toBeGreaterThan(10);
          }
        }
      }
    }
  });

  it("keeps crossing labels and intel neutral — no quality language", () => {
    for (const { round, crossing } of allCrossings()) {
      expect(crossing.label, `${round.id}/${crossing.id} label`).not.toMatch(CROSSING_LEAK);
      expect(crossing.intel, `${round.id}/${crossing.id} intel`).not.toMatch(CROSSING_LEAK);
      expect(crossing.intel, `${round.id}/${crossing.id} intel verdict`).not.toMatch(CROSSING_INTEL_VERDICT);
      expect(crossing.label, `${round.id}/${crossing.id} label verdict`).not.toMatch(CROSSING_INTEL_VERDICT);
    }
  });

  it("authorizes both exposures across the bank with authored arrival variants", () => {
    const exposures = new Set(allCrossings().map((c) => c.crossing.exposure));
    expect(exposures.has("low")).toBe(true);
    expect(exposures.has("high")).toBe(true);
    const arrivals = new Set(allCrossings().map((c) => `${c.crossing.arrival.x},${c.crossing.arrival.y}`));
    expect(arrivals.size).toBeGreaterThan(4);
  });
});

describe("circle-iq V5 — selectCrossing logic", () => {
  it("selects a valid crossing on the selected corridor", () => {
    const round = CIRCLE_IQ_ROUNDS[0]!;
    const option = round.options.find((o) => (o.crossings?.length ?? 0) > 0)!;
    const crossing = option.crossings![0]!;
    expect(selectCrossing(round, option.id, crossing.id, false)).toEqual({ ok: true, crossingId: crossing.id });
  });

  it("fails safely on unknown crossings, missing corridors, hold, and locked state", () => {
    const round = CIRCLE_IQ_ROUNDS[0]!;
    const move = round.options.find((o) => (o.crossings?.length ?? 0) > 0)!;
    const hold = round.options.find((o) => o.route.style === "hold");
    const valid = move.crossings![0]!.id;
    // Unknown crossing id.
    expect(selectCrossing(round, move.id, "nope", false)).toEqual({ ok: false, crossingId: null });
    // No corridor selected.
    expect(selectCrossing(round, null, valid, false)).toEqual({ ok: false, crossingId: null });
    // Unknown corridor.
    expect(selectCrossing(round, "nope", valid, false)).toEqual({ ok: false, crossingId: null });
    // Locked round.
    expect(selectCrossing(round, move.id, valid, true)).toEqual({ ok: false, crossingId: null });
    // Crossing from another option is rejected.
    const other = round.options.find((o) => o.id !== move.id && (o.crossings?.length ?? 0) > 0);
    if (other) {
      expect(selectCrossing(round, move.id, other.crossings![0]!.id, false)).toEqual({ ok: false, crossingId: null });
    }
    if (hold) {
      expect(selectCrossing(round, hold.id, valid, false)).toEqual({ ok: false, crossingId: null });
    }
  });

  it("replaces the previous crossing on the same corridor and clears on corridor switch", () => {
    const round = CIRCLE_IQ_ROUNDS[0]!;
    const move = round.options.find((o) => (o.crossings?.length ?? 0) === 2)!;
    const [a, b] = move.crossings!;
    // Replacement is the caller overwriting with the newest ok selection.
    expect(selectCrossing(round, move.id, a!.id, false).crossingId).toBe(a!.id);
    expect(selectCrossing(round, move.id, b!.id, false).crossingId).toBe(b!.id);
    // Corridor switch clears; same-corridor re-render keeps.
    expect(crossingAfterCorridorSwitch(move.id, "other", a!.id)).toBeNull();
    expect(crossingAfterCorridorSwitch(move.id, move.id, a!.id)).toBe(a!.id);
    expect(crossingAfterCorridorSwitch(move.id, null, a!.id)).toBeNull();
    expect(crossingAfterCorridorSwitch(null, move.id, null)).toBeNull();
  });
});

describe("circle-iq V5 — crossing-aware consequence mapping", () => {
  it("maps low exposure to a clean arrival on the authored coordinate", () => {
    const entry = allCrossings().find((c) => c.crossing.exposure === "low")!;
    const option = entry.round.options.find((o) => o.id === entry.optionId)!;
    const cons = consequenceForCrossing(option, entry.crossing);
    expect(cons.exposure).toBe("low");
    expect(cons.spotted).toBe(false);
    expect(cons.arrival).toEqual({ x: entry.crossing.arrival.x, y: entry.crossing.arrival.y });
    expect(cons.note).toBe(entry.crossing.note);
    // Scoring semantics unchanged: kind still follows the parent option.
    expect(cons.kind).toBe(option.quality === "strong" ? "arrived" : "caught-open");
  });

  it("maps high exposure to SPOTTED with the authored arrival and cost note", () => {
    const entry = allCrossings().find((c) => c.crossing.exposure === "high")!;
    const option = entry.round.options.find((o) => o.id === entry.optionId)!;
    const cons = consequenceForCrossing(option, entry.crossing);
    expect(cons.exposure).toBe("high");
    expect(cons.spotted).toBe(true);
    expect(cons.arrival).toEqual({ x: entry.crossing.arrival.x, y: entry.crossing.arrival.y });
    expect(cons.note).toBe(entry.crossing.note);
    expect(cons.kind).toBe(option.quality === "strong" ? "arrived" : "caught-open");
  });

  it("maps hold (no crossing) to the legacy frame with no arrival override", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      for (const option of round.options.filter((o) => o.route.style === "hold")) {
        const cons = consequenceForCrossing(option, null);
        expect(cons.kind).toBe("left-behind");
        expect(cons.exposure).toBeNull();
        expect(cons.arrival).toBeNull();
        expect(cons.note).toBeNull();
        expect(cons.spotted).toBe(false);
      }
    }
  });
});

describe("circle-iq V5 polish — geometry validator", () => {
  const baseCrossing = (over: Partial<CircleIqCrossing> = {}): CircleIqCrossing => ({
    id: "t-opt-a",
    label: "Test notch",
    intel: "Notch on the test line used only by the validator.",
    x: 100,
    y: 100,
    arrival: { x: 200, y: 100 },
    exposure: "low",
    note: "Validator fixture note.",
    ...over,
  });

  const fixtureRound = (crossings: readonly CircleIqCrossing[]): CircleIqRound => ({
    id: "fixture",
    title: "Fixture",
    situation: "A synthetic round that exercises the geometry validator.",
    question: "Where do you cross?",
    zone: { center: { x: 100, y: 100 }, radius: 90 },
    next: { center: { x: 220, y: 100 }, radius: 40 },
    player: { x: 40, y: 100 },
    landmarks: [{ id: "lm", label: "Test rock", type: "cover", x: 220, y: 100 }],
    options: [
      {
        id: "t-opt",
        label: "Take the test line",
        quality: "strong",
        explanation: "A fixture explanation long enough to satisfy content rules.",
        route: {
          style: "covered",
          points: [
            { x: 40, y: 100 },
            { x: 220, y: 100 },
          ],
          caption: "Test line into NEXT.",
        },
        crossings,
      },
    ],
    reveals: [{ id: "t-scout", kind: "landmark", targetId: "lm", title: "Test rock", intel: "Fixture intel.", x: 220, y: 100 }],
    principle: "Fixture principle for validator-only rounds.",
  });

  it("exposes the documented minimum distances", () => {
    expect(CROSSING_SCOUT_MIN_DISTANCE).toBe(20);
    expect(CROSSING_PAIR_MIN_DISTANCE).toBe(30);
    expect(CROSSING_CORRIDOR_MAX_DISTANCE).toBe(25);
  });

  it("passes a valid pair", () => {
    const round = fixtureRound([baseCrossing({ id: "t-opt-a", x: 100, y: 100 }), baseCrossing({ id: "t-opt-b", x: 160, y: 100, exposure: "high" })]);
    expect(validateCrossingGeometry([round])).toEqual([]);
  });

  it("fails exact overlap with a scout pin", () => {
    const round = fixtureRound([baseCrossing({ x: 220, y: 100 })]);
    const issues = validateCrossingGeometry([round]);
    expect(issues.some((i) => i.kind === "overlap" && i.detail.includes("t-scout"))).toBe(true);
  });

  it("fails exact overlap between sibling crossings", () => {
    const round = fixtureRound([baseCrossing({ id: "t-opt-a", x: 100, y: 100 }), baseCrossing({ id: "t-opt-b", x: 100, y: 100 })]);
    expect(validateCrossingGeometry([round]).some((i) => i.kind === "overlap")).toBe(true);
  });

  it("fails crossing/scout proximity under 20u but passes at exactly 20u", () => {
    const near = fixtureRound([baseCrossing({ x: 220 - (CROSSING_SCOUT_MIN_DISTANCE - 1), y: 100 })]);
    expect(validateCrossingGeometry([near]).some((i) => i.kind === "scout-proximity")).toBe(true);
    const edge = fixtureRound([baseCrossing({ x: 220 - CROSSING_SCOUT_MIN_DISTANCE, y: 100 })]);
    expect(validateCrossingGeometry([edge]).filter((i) => i.kind === "scout-proximity")).toEqual([]);
  });

  it("fails same-corridor pairs under 30u but passes at exactly 30u", () => {
    const near = fixtureRound([
      baseCrossing({ id: "t-opt-a", x: 100, y: 100 }),
      baseCrossing({ id: "t-opt-b", x: 100 + CROSSING_PAIR_MIN_DISTANCE - 1, y: 100 }),
    ]);
    expect(validateCrossingGeometry([near]).some((i) => i.kind === "pair-proximity")).toBe(true);
    const edge = fixtureRound([
      baseCrossing({ id: "t-opt-a", x: 100, y: 100 }),
      baseCrossing({ id: "t-opt-b", x: 100 + CROSSING_PAIR_MIN_DISTANCE, y: 100 }),
    ]);
    expect(validateCrossingGeometry([edge]).filter((i) => i.kind === "pair-proximity")).toEqual([]);
  });

  it("fails crossings that drift from their corridor and pins/arrivals outside the viewBox", () => {
    const drifted = fixtureRound([baseCrossing({ x: 100, y: 100 + CROSSING_CORRIDOR_MAX_DISTANCE + 1 })]);
    expect(validateCrossingGeometry([drifted]).some((i) => i.kind === "corridor-association")).toBe(true);
    const outside = fixtureRound([baseCrossing({ x: 361, y: 100, arrival: { x: 200, y: 241 } })]);
    const kinds = validateCrossingGeometry([outside]).map((i) => i.kind);
    expect(kinds).toContain("pin-bounds");
    expect(kinds).toContain("arrival-bounds");
  });

  it("measures pin-to-corridor distance for the shell's association rule", () => {
    const round = CIRCLE_IQ_ROUNDS[0]!;
    const option = round.options.find((o) => (o.crossings?.length ?? 0) > 0)!;
    for (const crossing of option.crossings!) {
      expect(crossingCorridorDistance(option, crossing)).toBeLessThanOrEqual(CROSSING_CORRIDOR_MAX_DISTANCE);
    }
  });

  it("passes every authored crossing in the current bank with zero issues", () => {
    expect(validateCrossingGeometry()).toEqual([]);
  });
});

describe("circle-iq V5 — resolveMapTap with crossing pins", () => {
  it("resolves taps on crossing pins to kind crossing", () => {
    const round = CIRCLE_IQ_ROUNDS[0]!;
    const option = round.options.find((o) => (o.crossings?.length ?? 0) > 0)!;
    const pins = option.crossings!.map((c) => ({ id: c.id, x: c.x, y: c.y, target: "crossing" as const }));
    for (const pin of pins) {
      expect(resolveMapTap(pins, [], pin.x, pin.y)).toEqual({ kind: "crossing", id: pin.id });
    }
  });

  it("keeps legacy behavior: untargeted pins still resolve to kind pin", () => {
    const pins = [{ id: "a", x: 82, y: 170 }];
    expect(resolveMapTap(pins, [], 82, 170)).toEqual({ kind: "pin", id: "a" });
  });

  it("prefers pins over corridors on exact ties, deterministically", () => {
    const pins = [{ id: "x", x: 160, y: 135, target: "crossing" as const }];
    const corridors = [{ optionId: "north", points: [{ x: 82, y: 170 }, { x: 238, y: 100 }] }];
    expect(resolveMapTap(pins, corridors, 160, 135)).toEqual({ kind: "crossing", id: "x" });
    expect(resolveMapTap(pins, corridors, 160, 135)).toEqual(resolveMapTap(pins, corridors, 160, 135));
  });

  it("resolves every authored crossing at mobile map scales", () => {
    for (const mapWidth of [232, 248, 256, 280, 310, 332]) {
      const mapHeight = (mapWidth * 240) / 360;
      for (const round of CIRCLE_IQ_ROUNDS) {
        for (const option of round.options) {
          const pins = (option.crossings ?? []).map((c) => ({ id: c.id, x: c.x, y: c.y, target: "crossing" as const }));
          for (const pin of pins) {
            const clientX = (pin.x / 360) * mapWidth;
            const clientY = (pin.y / 240) * mapHeight;
            const vx = (clientX / mapWidth) * 360;
            const vy = (clientY / mapHeight) * 240;
            expect(resolveMapTap(pins, [], vx, vy)).toEqual({ kind: "crossing", id: pin.id });
          }
        }
      }
    }
  });

  it("resolves float round-trip taps at exact crossing centers to the crossing, never the corridor", () => {
    // A client→viewBox round-trip leaves float dust (~1e-14). A pin that
    // sits exactly on its corridor must still win the tie — the corridor's
    // exactly-zero projection distance must not steal it.
    for (const round of CIRCLE_IQ_ROUNDS) {
      const pins = round.reveals.map((r) => ({ id: r.id, x: r.x, y: r.y, target: "scout" as const }));
      const corridors = round.options.map((o) => ({ optionId: o.id, points: o.route.points }));
      for (const option of round.options) {
        const xpins = (option.crossings ?? []).map((c) => ({ id: c.id, x: c.x, y: c.y, target: "crossing" as const }));
        for (const pin of xpins) {
          for (const mapWidth of [256, 390, 624]) {
            const mapHeight = (mapWidth * 240) / 360;
            const vx = (((pin.x / 360) * mapWidth) / mapWidth) * 360;
            const vy = (((pin.y / 240) * mapHeight) / mapHeight) * 240;
            expect(resolveMapTap([...pins, ...xpins], corridors, vx, vy)).toEqual({
              kind: "crossing",
              id: pin.id,
            });
          }
        }
      }
    }
  });

  it("resolves taps between nearby crossings deterministically", () => {
    for (const round of CIRCLE_IQ_ROUNDS) {
      for (const option of round.options) {
        const pins = (option.crossings ?? []).map((c) => ({ id: c.id, x: c.x, y: c.y, target: "crossing" as const }));
        if (pins.length < 2) continue;
        const mid = { x: (pins[0]!.x + pins[1]!.x) / 2, y: (pins[0]!.y + pins[1]!.y) / 2 };
        expect(resolveMapTap(pins, [], mid.x, mid.y)).toEqual(resolveMapTap(pins, [], mid.x, mid.y));
      }
    }
  });
});
