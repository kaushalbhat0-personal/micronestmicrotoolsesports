import { CIRCLE_IQ_ROUNDS, CIRCLE_IQ_TOTAL, type CircleIqOption, type CircleIqRound } from "./circle-iq-rounds";

export type {
  CircleIqLandmark,
  CircleIqOption,
  CircleIqQuality,
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
