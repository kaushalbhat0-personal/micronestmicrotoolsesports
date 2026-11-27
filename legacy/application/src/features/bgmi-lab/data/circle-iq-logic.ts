import { CIRCLE_IQ_ROUNDS, CIRCLE_IQ_TOTAL, type CircleIqCrossing, type CircleIqOption, type CircleIqReveal, type CircleIqRound } from "./circle-iq-rounds";

export type {
  CircleIqCrossing,
  CircleIqLandmark,
  CircleIqOption,
  CircleIqQuality,
  CircleIqReveal,
  CircleIqRevealKind,
  CircleIqRound,
  CircleIqRoute,
  CircleIqRoutePoint,
  CircleIqRouteStyle,
} from "./circle-iq-rounds";

/**
 * Circle IQ pure game logic — no React, no DOM, no persistence.
 * The island component is a thin renderer over these helpers so scoring,
 * completion, and interpretation are unit-testable without a browser.
 */

export interface CircleIqPick {
  /** Points earned by this pick: 1 for a strong read, 0 otherwise. */
  readonly points: number;
  readonly isStrong: boolean;
}

/**
 * Resolve a pick. Unknown option ids score 0 (fail-closed).
 * Double-picks are prevented by the caller passing `alreadyAnswered`;
 * a repeated pick on an answered round earns nothing.
 */
export function scorePick(round: CircleIqRound, optionId: string, alreadyAnswered: boolean): CircleIqPick {
  if (alreadyAnswered) return { points: 0, isStrong: false };
  const option = round.options.find((o) => o.id === optionId);
  if (!option) return { points: 0, isStrong: false };
  const isStrong = option.quality === "strong";
  return { points: isStrong ? 1 : 0, isStrong };
}

/** Completion occurs exactly after the last round is answered. */
export function isComplete(answeredCount: number): boolean {
  return answeredCount >= CIRCLE_IQ_TOTAL;
}

export interface CircleIqSummary {
  readonly score: number;
  readonly total: number;
  readonly heading: string;
  readonly body: string;
}

/**
 * Completion interpretation — training feedback, never a skill rating.
 * Deliberately non-authoritative: no percentiles, no IGL grades.
 */
export function summarizeScore(score: number): CircleIqSummary {
  const total = CIRCLE_IQ_TOTAL;
  if (score >= 7) {
    return {
      score,
      total,
      heading: "Strong reads",
      body: "You consistently favored early positioning and protected routes. Replay to test whether the calls hold when the situations change.",
    };
  }
  if (score >= 5) {
    return {
      score,
      total,
      heading: "Good foundation",
      body: "Your calls were mixed, especially when timing and cover competed. Replay the rounds that felt close — the explanations carry the transferable part.",
    };
  }
  return {
    score,
    total,
    heading: "Warming up",
    body: "Several calls favored distance or patience over cover and timing. Replay with the principles in mind: early beats late, and cover often beats distance.",
  };
}

/** Future ShareRow shape: score + total + canonical path + registry shareText. No URLs built here. */
export interface CircleIqResult {
  readonly score: number;
  readonly total: number;
  readonly completedRounds: number;
}

export function buildResult(score: number, answeredCount: number): CircleIqResult {
  return { score, total: CIRCLE_IQ_TOTAL, completedRounds: Math.min(answeredCount, CIRCLE_IQ_TOTAL) };
}

/**
 * Seeded per-run variation — pure deterministic helpers (V3).
 *
 * One ephemeral run seed (never stored) drives both round order and
 * per-round option display order. Scoring stays ID-based, so shuffling is
 * presentation-only and can never change correctness.
 */

/** Ephemeral run seed. Uses crypto randomness when available, Math.random otherwise. Never stored. */
export function createRunSeed(): number {
  try {
    const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (array: Uint32Array) => Uint32Array } }).crypto;
    if (cryptoApi?.getRandomValues) return cryptoApi.getRandomValues(new Uint32Array(1))[0]! >>> 0;
  } catch {
    // Fall through to Math.random — still ephemeral, still unstored.
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** Deterministic PRNG (mulberry32). Same seed → same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const swap = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = swap;
  }
  return arr;
}

/**
 * Run-level round order. Same seed → same order; never mutates the bank.
 * `roundIndex` mixes into the option stream so each queue position shuffles
 * independently of the round's authored position.
 */
export function orderRoundsForRun(rounds: readonly CircleIqRound[], seed: number): CircleIqRound[] {
  return shuffled(rounds, mulberry32(seed));
}

/** Display-only option order for one queue position. Authored data untouched. */
export function orderOptionsForRound(round: CircleIqRound, seed: number, roundIndex: number): CircleIqOption[] {
  return shuffled(round.options, mulberry32((seed ^ Math.imul(roundIndex + 1, 0x9e3779b9)) >>> 0));
}

/**
 * Tendency mirror — honest run feedback from authored option ids (V3).
 * Counts only actual misses; never invents a weakness on a perfect run.
 */
export type CircleIqTendency = "hold" | "open" | "contested" | "mixed";

const HOLD_IDS = new Set(["hold-compound", "hold-split", "hold-ditch", "drive-late"]);
const CONTESTED_IDS = new Set(["contest-north", "fight-east", "central-rock"]);

export function tendencyForMisses(missedOptionIds: readonly string[]): CircleIqTendency | null {
  if (missedOptionIds.length === 0) return null;
  let hold = 0;
  let contested = 0;
  let open = 0;
  for (const id of missedOptionIds) {
    if (HOLD_IDS.has(id)) hold += 1;
    else if (CONTESTED_IDS.has(id)) contested += 1;
    else open += 1;
  }
  if (hold > contested && hold > open) return "hold";
  if (contested > hold && contested > open) return "contested";
  if (open > hold && open > contested) return "open";
  return "mixed";
}

export function tendencyLine(tendency: CircleIqTendency | null): string {
  switch (tendency) {
    case "hold":
      return "You tended to hold a beat too long — early moves were the safer practice read.";
    case "open":
      return "You favored the shorter line over the protected route.";
    case "contested":
      return "You took the contested line when a quieter edge was available.";
    case "mixed":
      return "Your misses were spread across timing, cover, and contested calls.";
    case null:
      return "You consistently favored early positioning and protected routes.";
  }
}

export { CIRCLE_IQ_ROUNDS, CIRCLE_IQ_TOTAL };

/**
 * V4 scout system — information triage, not an economy.
 * Every round grants exactly 2 scouts. Inspecting a target spends one
 * scout; the same target can never consume twice; unknown ids fail
 * safely (no scout spent). Locked rounds (after COMMIT) cannot scout.
 */

export const SCOUTS_PER_ROUND = 2;

export interface CircleIqScoutState {
  readonly scoutsLeft: number;
  readonly inspectedIds: readonly string[];
}

export function createScoutState(): CircleIqScoutState {
  return { scoutsLeft: SCOUTS_PER_ROUND, inspectedIds: [] };
}

export interface CircleIqInspectResult {
  readonly state: CircleIqScoutState;
  /** True only when a scout was actually spent on this call. */
  readonly consumed: boolean;
}

/**
 * Attempt to inspect a reveal. Fail-closed: unknown ids, already-inspected
 * ids, locked rounds, and empty budgets all return the state unchanged
 * with `consumed: false` (never below 0).
 */
export function inspectReveal(
  state: CircleIqScoutState,
  revealId: string,
  validIds: readonly string[],
  locked: boolean,
): CircleIqInspectResult {
  if (locked) return { state, consumed: false };
  if (!validIds.includes(revealId)) return { state, consumed: false };
  if (state.inspectedIds.includes(revealId)) return { state, consumed: false };
  if (state.scoutsLeft <= 0) return { state, consumed: false };
  return {
    state: {
      scoutsLeft: state.scoutsLeft - 1,
      inspectedIds: [...state.inspectedIds, revealId],
    },
    consumed: true,
  };
}

/** Compact debrief line — information use, never currency. */
export function scoutNote(scoutsUsed: number): string {
  if (scoutsUsed <= 0) return "Solved cold — no scouts used.";
  if (scoutsUsed >= SCOUTS_PER_ROUND) return `Used both scouts before committing.`;
  return `Used ${scoutsUsed} of ${SCOUTS_PER_ROUND} scouts.`;
}

/**
 * Outcome-differentiated consequence copy. Shown only AFTER commit.
 * Strong/covered arrives; weak/open is caught mid-route; weak/hold never
 * leaves and the zone passes it by.
 */
export type CircleIqConsequenceKind = "arrived" | "caught-open" | "left-behind";

export function consequenceKindFor(option: CircleIqOption): CircleIqConsequenceKind {
  if (option.quality === "strong") return "arrived";
  return option.route.style === "hold" ? "left-behind" : "caught-open";
}

export interface CircleIqConsequenceCopy {
  readonly heading: string;
  readonly line: string;
}

export function consequenceCopyFor(option: CircleIqOption): CircleIqConsequenceCopy {
  switch (consequenceKindFor(option)) {
    case "arrived":
      return {
        heading: "Arrived",
        line: "Arrived with time to spare. The zone tightens on your position.",
      };
    case "caught-open":
      return {
        heading: "Caught out",
        line: "Caught in the open — the zone closes past you.",
      };
    case "left-behind":
      return {
        heading: "Left behind",
        line: "Held too long — the zone leaves the position behind.",
      };
  }
}

/** Every reveal id in a round must be unique. */
export function revealIdsFor(round: CircleIqRound): readonly string[] {
  return round.reveals.map((r) => r.id);
}

/** A reveal target must be a real landmark id or option id in the same round. */
export function isRevealTargetValid(round: CircleIqRound, reveal: CircleIqReveal): boolean {
  return (
    round.landmarks.some((l) => l.id === reveal.targetId) ||
    round.options.some((o) => o.id === reveal.targetId)
  );
}

/**
 * SVG-level nearest-target tap dispatch (responsive hardening).
 *
 * The 360×240 map scales fluidly, so fixed-unit SVG hit circles shrink
 * below 44px on phones (232px map at 360px viewport → 0.64 scale → a
 * r=22 hit circle is only ~28px). Enlarging hit circles is rejected:
 * overlapping regions dispatch ambiguously. Instead, taps are resolved
 * here, in pure viewBox coordinates, by nearest valid target.
 *
 * Threshold reasoning (single constant): the smallest supported map is
 * ~256px wide (360px viewport after in-island padding relief), i.e.
 * scale ≈ 0.71. Requiring an effective touch diameter ≥ 44px gives
 * 2 × T × 0.71 ≥ 44 → T ≥ 31. MAP_TAP_THRESHOLD = 36 adds comfort
 * margin (≈51px effective at 360px, ≈62px at 412px). Overlapping
 * threshold regions are harmless: nearest distance always wins, so the
 * threshold only gates far-field taps into no-ops — it never misfires.
 *
 * Pure: no DOM, no React, no side effects, no input mutation. O(n).
 * The caller converts client → viewBox coordinates and passes only
 * currently actionable targets; the dispatcher calls back into the
 * existing shared transitions (inspect/preview), never duplicating them.
 */

export const MAP_TAP_THRESHOLD = 36;

export interface CircleIqTapPin {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /**
   * V5 Hybrid: pins carry their surface. Scout pins inspect intel;
   * crossing pins select a crossing on the active corridor. Omitted
   * (legacy callers) resolves as a scout-style "pin".
   */
  readonly target?: "scout" | "crossing";
}

export interface CircleIqTapCorridor {
  readonly optionId: string;
  readonly points: readonly { readonly x: number; readonly y: number }[];
}

export type CircleIqTapResult =
  | { readonly kind: "pin"; readonly id: string }
  | { readonly kind: "crossing"; readonly id: string }
  | { readonly kind: "corridor"; readonly optionId: string }
  | null;

function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.min(Math.max(((px - ax) * dx + (py - ay) * dy) / lenSq, 0), 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function corridorDistance(
  points: readonly { readonly x: number; readonly y: number }[],
  x: number,
  y: number,
): number {
  if (points.length === 0) return Number.POSITIVE_INFINITY;
  if (points.length === 1) return Math.hypot(x - points[0]!.x, y - points[0]!.y);
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const d = pointToSegmentDistance(x, y, a.x, a.y, b.x, b.y);
    if (d < best) best = d;
  }
  return best;
}

/** Snap physically meaningless sub-epsilon distances to zero for stable ties. */
function snapTiny(d: number): number {
  return d < 1e-9 ? 0 : d;
}

/**
 * Resolve a viewBox-space tap to the nearest actionable target.
 * Pins are evaluated before corridors, so an exact-distance tie
 * deterministically favors the pin (strict `<` keeps first-in-order).
 * Crossing pins resolve to `{ kind: "crossing" }`; every other pin
 * resolves to `{ kind: "pin" }` exactly as before.
 * Sub-epsilon distances (< 1e-9 viewBox units, far below any physical
 * meaning) snap to zero so a client→viewBox float round-trip landing on
 * a pin that sits exactly on its corridor line can never lose the tie
 * to the corridor's exactly-zero projection distance.
 * Returns null when nothing is within threshold — the caller no-ops.
 */
export function resolveMapTap(
  pins: readonly CircleIqTapPin[],
  corridors: readonly CircleIqTapCorridor[],
  x: number,
  y: number,
  threshold: number = MAP_TAP_THRESHOLD,
): CircleIqTapResult {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(threshold > 0)) return null;
  let best: CircleIqTapResult = null;
  let bestDist = threshold;
  for (const pin of pins) {
    const d = snapTiny(Math.hypot(x - pin.x, y - pin.y));
    if (d < bestDist) {
      bestDist = d;
      best = pin.target === "crossing" ? { kind: "crossing", id: pin.id } : { kind: "pin", id: pin.id };
    }
  }
  for (const corridor of corridors) {
    const d = snapTiny(corridorDistance(corridor.points, x, y));
    if (d < bestDist) {
      bestDist = d;
      best = { kind: "corridor", optionId: corridor.optionId };
    }
  }
  return best;
}

/**
 * V5 authoring-time geometry validator (polish pass).
 *
 * Enforces the spatial contract every crossing must satisfy so pins stay
 * visually unambiguous without enlarging hitboxes:
 * - no exact coordinate overlap (crossing↔scout, crossing↔crossing)
 * - crossing ↔ scout pins of the same round stay >= 20 viewBox units apart
 * - same-corridor crossing pairs stay >= 30 units apart
 * - every crossing stays within 25 units of its own corridor polyline, so
 *   the pin always reads as part of its corridor (inside the 36u dispatch
 *   threshold, so taps near the pin still resolve sanely)
 * - pins and arrivals stay inside the 360×240 viewBox
 *
 * Pure: returns the issue list (empty = valid). No exceptions, no
 * bypasses — an intentional exception must be reported, never silent.
 */
export const CROSSING_SCOUT_MIN_DISTANCE = 20;
export const CROSSING_PAIR_MIN_DISTANCE = 30;
export const CROSSING_CORRIDOR_MAX_DISTANCE = 25;

export type CircleIqGeometryIssueKind =
  | "pin-bounds"
  | "overlap"
  | "scout-proximity"
  | "pair-proximity"
  | "corridor-association"
  | "arrival-bounds";

export interface CircleIqGeometryIssue {
  readonly roundId: string;
  readonly optionId: string;
  readonly crossingId: string | null;
  readonly kind: CircleIqGeometryIssueKind;
  readonly detail: string;
}

function inViewBox(x: number, y: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 360 && y >= 0 && y <= 240;
}

/** Shortest distance from a crossing pin to its corridor polyline. Exported for tests. */
export function crossingCorridorDistance(option: CircleIqOption, crossing: CircleIqCrossing): number {
  return corridorDistance(option.route.points, crossing.x, crossing.y);
}

export function validateCrossingGeometry(
  rounds: readonly CircleIqRound[] = CIRCLE_IQ_ROUNDS,
): readonly CircleIqGeometryIssue[] {
  const issues: CircleIqGeometryIssue[] = [];
  for (const round of rounds) {
    for (const option of round.options) {
      const crossings = option.crossings ?? [];
      for (const crossing of crossings) {
        if (!inViewBox(crossing.x, crossing.y)) {
          issues.push({
            roundId: round.id,
            optionId: option.id,
            crossingId: crossing.id,
            kind: "pin-bounds",
            detail: `pin (${crossing.x},${crossing.y}) outside 360×240`,
          });
        }
        if (!inViewBox(crossing.arrival.x, crossing.arrival.y)) {
          issues.push({
            roundId: round.id,
            optionId: option.id,
            crossingId: crossing.id,
            kind: "arrival-bounds",
            detail: `arrival (${crossing.arrival.x},${crossing.arrival.y}) outside 360×240`,
          });
        }
        for (const reveal of round.reveals) {
          if (crossing.x === reveal.x && crossing.y === reveal.y) {
            issues.push({
              roundId: round.id,
              optionId: option.id,
              crossingId: crossing.id,
              kind: "overlap",
              detail: `${crossing.id} exactly overlaps scout ${reveal.id}`,
            });
          } else if (Math.hypot(crossing.x - reveal.x, crossing.y - reveal.y) < CROSSING_SCOUT_MIN_DISTANCE) {
            issues.push({
              roundId: round.id,
              optionId: option.id,
              crossingId: crossing.id,
              kind: "scout-proximity",
              detail: `${crossing.id} within ${CROSSING_SCOUT_MIN_DISTANCE}u of scout ${reveal.id}`,
            });
          }
        }
        if (crossingCorridorDistance(option, crossing) > CROSSING_CORRIDOR_MAX_DISTANCE) {
          issues.push({
            roundId: round.id,
            optionId: option.id,
            crossingId: crossing.id,
            kind: "corridor-association",
            detail: `${crossing.id} drifts from corridor ${option.id}`,
          });
        }
      }
      for (let i = 0; i < crossings.length; i++) {
        for (let j = i + 1; j < crossings.length; j++) {
          const a = crossings[i]!;
          const b = crossings[j]!;
          if (a.x === b.x && a.y === b.y) {
            issues.push({
              roundId: round.id,
              optionId: option.id,
              crossingId: a.id,
              kind: "overlap",
              detail: `${a.id} exactly overlaps ${b.id}`,
            });
          } else if (Math.hypot(a.x - b.x, a.y - b.y) < CROSSING_PAIR_MIN_DISTANCE) {
            issues.push({
              roundId: round.id,
              optionId: option.id,
              crossingId: a.id,
              kind: "pair-proximity",
              detail: `${a.id} within ${CROSSING_PAIR_MIN_DISTANCE}u of ${b.id}`,
            });
          }
        }
      }
    }
  }
  return issues;
}

/**
 * V5 Hybrid crossing selection — pure, fail-closed, no DOM.
 *
 * The corridor (parent option) must already be selected; the crossing
 * must belong to that corridor; locked rounds cannot select. Returns
 * `{ ok: true, crossingId }` only for a genuine new selection — every
 * other case returns `{ ok: false, crossingId: null }` and the caller
 * keeps its existing state untouched. Re-selecting another crossing of
 * the same corridor replaces the previous one (caller overwrites).
 */
export interface CircleIqCrossingSelection {
  readonly ok: boolean;
  readonly crossingId: string | null;
}

export function crossingForOption(
  round: CircleIqRound,
  optionId: string,
  crossingId: string,
): CircleIqCrossing | null {
  const option = round.options.find((o) => o.id === optionId);
  if (!option) return null;
  return option.crossings?.find((c) => c.id === crossingId) ?? null;
}

export function selectCrossing(
  round: CircleIqRound,
  corridorOptionId: string | null,
  crossingId: string,
  locked: boolean,
): CircleIqCrossingSelection {
  if (locked) return { ok: false, crossingId: null };
  if (corridorOptionId === null) return { ok: false, crossingId: null };
  const option = round.options.find((o) => o.id === corridorOptionId);
  if (!option) return { ok: false, crossingId: null };
  if (!option.crossings || option.crossings.length === 0) return { ok: false, crossingId: null };
  const crossing = option.crossings.find((c) => c.id === crossingId);
  if (!crossing) return { ok: false, crossingId: null };
  return { ok: true, crossingId: crossing.id };
}

/**
 * Corridor switches always clear the crossing — a crossing belongs to
 * exactly one corridor, so keeping it across a switch would misresolve.
 * Returns null whenever the corridor changed (or was cleared).
 */
export function crossingAfterCorridorSwitch(
  previousCorridorId: string | null,
  nextCorridorId: string | null,
  currentCrossingId: string | null,
): string | null {
  if (currentCrossingId === null) return null;
  return previousCorridorId === nextCorridorId ? currentCrossingId : null;
}

/**
 * Crossing-aware consequence mapping. The base kind reuses the existing
 * authored mapping (scoring semantics unchanged — the crossing resolves
 * to its parent option's quality). Exposure only selects the variant:
 * high exposure flashes SPOTTED and lands on the authored arrival with
 * its cost note; low exposure traverses cleanly to the authored arrival.
 * Hold (no crossing) reuses the legacy final frame.
 */
export interface CircleIqCrossingConsequence {
  readonly kind: CircleIqConsequenceKind;
  readonly exposure: "low" | "high" | null;
  readonly arrival: { readonly x: number; readonly y: number } | null;
  readonly note: string | null;
  readonly spotted: boolean;
}

export function consequenceForCrossing(
  option: CircleIqOption,
  crossing: CircleIqCrossing | null,
): CircleIqCrossingConsequence {
  const kind = consequenceKindFor(option);
  if (!crossing) {
    return { kind, exposure: null, arrival: null, note: null, spotted: false };
  }
  return {
    kind,
    exposure: crossing.exposure,
    arrival: { x: crossing.arrival.x, y: crossing.arrival.y },
    note: crossing.note,
    spotted: crossing.exposure === "high",
  };
}
