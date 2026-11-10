import {
  IGL_DECISION_SCENARIOS,
  IGL_DECISION_TOTAL,
  type IglFamily,
  type IglScenario,
} from "./igl-decision-scenarios";

/**
 * IGL Decision Drill pure game logic — no React, no DOM, no persistence.
 * The island component is a thin renderer over these helpers so picks,
 * completion, and interpretation are unit-testable without a browser.
 *
 * SCORING CONTRACT (documented, no skill semantics):
 * a "stronger call" counts a pick that matches the scenario's authored
 * stronger option (see `quality` in the bank). It measures alignment
 * between the player's call and the authored rationale for that
 * situation — NOT tactical correctness, NOT IGL skill, NOT prediction.
 * Unknown option ids score 0 (fail-closed); repeat picks earn nothing.
 */

export type { IglBrief, IglFamily, IglIntel, IglOption, IglQuality, IglScenario } from "./igl-decision-scenarios";

export interface IglPick {
  /** Points earned by this pick: 1 for a stronger call, 0 otherwise. */
  readonly points: number;
  readonly isStrong: boolean;
}

/**
 * Resolve a pick. Unknown option ids score 0 (fail-closed).
 * Double-picks are prevented by the caller passing `alreadyAnswered`;
 * a repeated pick on an answered scenario earns nothing.
 */
export function scoreIglPick(scenario: IglScenario, optionId: string, alreadyAnswered: boolean): IglPick {
  if (alreadyAnswered) return { points: 0, isStrong: false };
  const option = scenario.options.find((o) => o.id === optionId);
  if (!option) return { points: 0, isStrong: false };
  const isStrong = option.quality === "strong";
  return { points: isStrong ? 1 : 0, isStrong };
}

/** Completion occurs exactly after the last scenario is answered. */
export function isIglComplete(answeredCount: number): boolean {
  return answeredCount >= IGL_DECISION_TOTAL;
}

export interface IglSummary {
  readonly strong: number;
  readonly total: number;
  readonly heading: string;
  readonly body: string;
}

/**
 * Completion interpretation — decision feedback, never a skill rating.
 * Deliberately non-authoritative: no percentiles, no IGL grades, no
 * prediction claims. Says what the number counts, every time.
 */
export function summarizeIgl(strong: number): IglSummary {
  const total = IGL_DECISION_TOTAL;
  if (strong >= 5) {
    return {
      strong,
      total,
      heading: "Composed IGL",
      body: `Your calls matched the scenario rationale in ${strong} of ${total} situations. That measures alignment with the reasoning here — not ability, and not what any real team would do.`,
    };
  }
  if (strong >= 3) {
    return {
      strong,
      total,
      heading: "Developing judgment",
      body: `Your calls matched the scenario rationale in ${strong} of ${total} situations. Re-read the debriefs: different pressure rewards different calls.`,
    };
  }
  return {
    strong,
    total,
    heading: "Warming up",
    body: `Your calls matched the scenario rationale in ${strong} of ${total} situations. That is fine — the count tracks alignment with the reasoning here, not ability. The debriefs carry the transferable part.`,
  };
}

/** Future ShareRow shape: score + total + canonical path + registry shareText. No URLs built here. */
export interface IglResult {
  readonly strong: number;
  readonly total: number;
  readonly completedScenarios: number;
}

export function buildIglResult(strong: number, answeredCount: number): IglResult {
  return { strong, total: IGL_DECISION_TOTAL, completedScenarios: Math.min(answeredCount, IGL_DECISION_TOTAL) };
}

/**
 * Decision tendency — honest run feedback from the families of the
 * riskier calls actually picked (V1).
 * Counts only actual misses; never invents a tendency on a perfect run.
 * A strict majority names its family; ties and spreads read as mixed.
 */
export type IglTendency = IglFamily | "mixed";

export function tendencyForIglMisses(missedFamilies: readonly IglFamily[]): IglTendency | null {
  if (missedFamilies.length === 0) return null;
  const counts: Record<IglFamily, number> = { fight: 0, avoid: 0, hold: 0, rotate: 0 };
  for (const family of missedFamilies) {
    counts[family] += 1;
  }
  const ranked: [IglFamily, number][] = (Object.entries(counts) as [IglFamily, number][]).sort(
    (a, b) => b[1] - a[1]
  );
  const [topFamily, topCount] = ranked[0]!;
  const [, secondCount] = ranked[1]!;
  if (topCount > secondCount) return topFamily;
  return "mixed";
}

export function tendencyLine(tendency: IglTendency | null): string {
  switch (tendency) {
    case "fight":
      return "You leaned into fights when conceding ground preserved more options in these spots.";
    case "avoid":
      return "You slipped away from pressure when committing to a line kept more control.";
    case "hold":
      return "You held position when moving early protected the run.";
    case "rotate":
      return "You rotated early when patience and information held more value.";
    case "mixed":
      return "Your riskier calls spread across fights, holds, and rotations — re-read the situations where timing beat position.";
    case null:
      return "You matched the rationale in every situation — composed calls under pressure.";
  }
}

export { IGL_DECISION_SCENARIOS, IGL_DECISION_TOTAL };
