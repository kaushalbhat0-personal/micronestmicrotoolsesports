import { describe, expect, it } from "vitest";
import { resolveStandings, type ResolveInput } from "./resolve";
import type { CompetitionResult, RuleId, ScoringConfig, Team } from "../types";
import { DEFAULT_SCORING } from "../types";
import { GROUP_STAGE_ORDER, ROUND_ROBIN_ORDER, SWISS_LITE_ORDER } from "../presets";

function t(id: string, name: string): Team {
  return { id, name };
}

let resultSeq = 0;
function win(
  a: string,
  b: string,
  winner: string,
  maps?: readonly [number, number],
  rounds?: readonly [number, number],
): CompetitionResult {
  resultSeq += 1;
  return {
    id: `r${resultSeq}`,
    teamAId: a,
    teamBId: b,
    outcome: { kind: "win", winnerTeamId: winner },
    ...(maps ? { mapsA: maps[0], mapsB: maps[1] } : {}),
    ...(rounds ? { roundsA: rounds[0], roundsB: rounds[1] } : {}),
    isComplete: true,
  };
}

function draw(a: string, b: string): CompetitionResult {
  resultSeq += 1;
  return { id: `r${resultSeq}`, teamAId: a, teamBId: b, outcome: { kind: "draw" }, isComplete: true };
}

const DRAW_SCORING: ScoringConfig = { ...DEFAULT_SCORING, drawsEnabled: true };

function orderOf(input: ResolveInput): string[] {
  return resolveStandings(input).entries.map((e) => e.teamId);
}

describe("resolveStandings", () => {
  it("resolves a simple table with no ties on points", () => {
    const teams = [t("a", "Falcons"), t("b", "Sentinels"), t("c", "Wolves")];
    const input: ResolveInput = {
      teams,
      results: [win("a", "b", "a"), win("a", "c", "a"), win("b", "c", "b")],
      scoring: DEFAULT_SCORING,
      ruleOrder: ["points"],
    };
    const result = resolveStandings(input);
    expect(orderOf(input)).toEqual(["a", "b", "c"]);
    expect(result.tieGroups).toHaveLength(0);
    expect(result.entries[0]?.points).toBe(6);
  });

  it("resolves a two-team points tie with head-to-head", () => {
    const teams = [t("a", "Falcons"), t("b", "Sentinels"), t("c", "Wolves"), t("d", "Hawks")];
    const input: ResolveInput = {
      teams,
      // A: W(B) L(C) L(D) = 3 · B: L(A) W(C) L(D) = 3 · H2H: A beat B.
      results: [
        win("a", "b", "a"),
        win("a", "c", "c"),
        win("a", "d", "d"),
        win("b", "c", "b"),
        win("b", "d", "d"),
        win("c", "d", "c"),
      ],
      scoring: DEFAULT_SCORING,
      ruleOrder: ["points", "h2h", "map_diff", "round_diff", "wins"],
    };
    // C=6 D=6 (H2H C beat D → C first), A=3 B=3 (H2H A first).
    expect(orderOf(input)).toEqual(["c", "d", "a", "b"]);
    const entries = resolveStandings(input).entries;
    expect(entries.find((e) => e.teamId === "c")?.decisiveRule).toBe("h2h");
    expect(entries.find((e) => e.teamId === "a")?.decisiveRule).toBe("h2h");
  });

  it("falls through tied H2H to map differential", () => {
    const teams = [t("a", "Falcons"), t("b", "Sentinels"), t("c", "Wolves")];
    const input: ResolveInput = {
      teams,
      // A and B draw each other; both beat C. H2H tied → maps decide.
      results: [
        { ...draw("a", "b"), id: "rd1" },
        win("a", "c", "a", [2, 0]),
        win("b", "c", "b", [2, 1]),
      ],
      scoring: DRAW_SCORING,
      ruleOrder: ["points", "h2h", "map_diff", "round_diff", "wins"],
    };
    expect(orderOf(input)).toEqual(["a", "b", "c"]);
    const entries = resolveStandings(input).entries;
    expect(entries.find((e) => e.teamId === "a")?.decisiveRule).toBe("map_diff");
  });

  it("uses round differential when maps are tied", () => {
    const teams = [t("a", "Falcons"), t("b", "Sentinels"), t("c", "Wolves")];
    const input: ResolveInput = {
      teams,
      results: [
        { ...draw("a", "b"), id: "rd1" },
        win("a", "c", "a", [2, 0], [26, 10]),
        win("b", "c", "b", [2, 0], [26, 20]),
      ],
      scoring: DRAW_SCORING,
      ruleOrder: ["points", "h2h", "map_diff", "round_diff", "wins"],
    };
    expect(orderOf(input)).toEqual(["a", "b", "c"]);
    expect(resolveStandings(input).entries.find((e) => e.teamId === "a")?.decisiveRule).toBe("round_diff");
  });

  it("resolves a three-team circular H2H via map differential", () => {
    const teams = [t("a", "Falcons"), t("b", "Sentinels"), t("c", "Wolves"), t("d", "Hawks")];
    const input: ResolveInput = {
      teams,
      // Rock-paper-scissors among A/B/C (each 3 pts internally), all beat D.
      results: [
        win("a", "b", "a", [2, 1]),
        win("b", "c", "b", [2, 1]),
        win("c", "a", "c", [2, 1]),
        win("a", "d", "a", [2, 0]),
        win("b", "d", "b", [2, 0]),
        win("c", "d", "c", [2, 0]),
      ],
      scoring: DEFAULT_SCORING,
      ruleOrder: ["points", "h2h", "map_diff", "round_diff", "wins"],
    };
    const result = resolveStandings(input);
    // All on 6 points; H2H mini-table all on 3 → circular, no separation recorded.
    expect(result.evaluations.find((e) => e.rule === "h2h")?.separated).toBe(false);
    // Map diffs all +2 (e.g. A: +1 −1 +2), no round data, wins all 2 → A/B/C stay tied.
    expect(result.tieGroups.length).toBeGreaterThan(0);
  });

  it("recursively resolves: H2H separates one team, maps resolve the rest", () => {
    // A/B/C all finish on 4 points. H2H mini-table: A=4, B=4, C=0 → C placed
    // last by H2H; A/B recurse and split on map difference. E tops the table alone.
    const teams = [t("a", "Falcons"), t("b", "Sentinels"), t("c", "Wolves"), t("e", "Hawks")];
    const input: ResolveInput = {
      teams,
      results: [
        { ...draw("a", "b"), id: "rd1", mapsA: 1, mapsB: 1 },
        win("a", "c", "a", [2, 0]),
        win("b", "c", "b", [2, 1]),
        win("a", "e", "e"),
        win("b", "e", "e"),
        win("c", "e", "c"),
        { ...draw("c", "e"), id: "rd2" },
      ],
      scoring: DRAW_SCORING,
      ruleOrder: ["points", "h2h", "map_diff", "round_diff", "wins"],
    };
    expect(orderOf(input)).toEqual(["e", "a", "b", "c"]);
    const entries = resolveStandings(input).entries;
    // A above B on maps (the finer distinction vs the neighbour below);
    // C placed last by the H2H split. The trio's H2H explanation is recorded.
    expect(entries.find((e) => e.teamId === "a")?.decisiveRule).toBe("map_diff");
    // A map diff: (1-1) + (2-0) = +2. B: (1-1) + (2-1) = +1. A above B on maps.
    expect(entries.find((e) => e.teamId === "b")?.decisiveRule).toBe("map_diff");
    expect(entries.find((e) => e.teamId === "c")?.decisiveRule).toBe("h2h");
    expect(
      resolveStandings(input).explanations.some((e) => e.scope === "separation" && e.decisiveRule === "h2h"),
    ).toBe(true);
    expect(entries.find((e) => e.teamId === "c")?.decisiveRule).toBe("h2h");
  });

  it("keeps a completely unresolved tie explicit", () => {
    const teams = [t("a", "Falcons"), t("b", "Sentinels")];
    const input: ResolveInput = {
      teams,
      results: [{ ...draw("a", "b"), id: "rd1" }],
      scoring: DRAW_SCORING,
      ruleOrder: ["points", "h2h", "map_diff"],
    };
    const result = resolveStandings(input);
    expect(result.tieGroups).toHaveLength(1);
    expect(result.entries.every((e) => e.tied)).toBe(true);
    expect(result.explanations.some((e) => e.scope === "unresolved")).toBe(true);
  });

  it("counts draws in points and records them", () => {
    const teams = [t("a", "Falcons"), t("b", "Sentinels")];
    const result = resolveStandings({
      teams,
      results: [{ ...draw("a", "b"), id: "rd1" }],
      scoring: DRAW_SCORING,
      ruleOrder: ["points"],
    });
    expect(result.entries[0]?.points).toBe(1);
    expect(result.entries[0]?.draws).toBe(1);
  });

  it("ignores incomplete results", () => {
    const teams = [t("a", "Falcons"), t("b", "Sentinels")];
    const incomplete: CompetitionResult = {
      id: "rx",
      teamAId: "a",
      teamBId: "b",
      outcome: { kind: "win", winnerTeamId: "a" },
      isComplete: false,
    };
    const result = resolveStandings({
      teams,
      results: [incomplete],
      scoring: DEFAULT_SCORING,
      ruleOrder: ["points", "h2h"],
    });
    expect(result.entries.every((e) => e.points === 0)).toBe(true);
    expect(result.tieGroups).toHaveLength(1);
  });

  it("counts duplicate pairs (home/away legs) as separate results", () => {
    const teams = [t("a", "Falcons"), t("b", "Sentinels")];
    const result = resolveStandings({
      teams,
      results: [win("a", "b", "a"), win("a", "b", "b")],
      scoring: DEFAULT_SCORING,
      ruleOrder: ["points", "h2h", "map_diff", "round_diff", "wins"],
    });
    expect(result.entries.every((e) => e.points === 3)).toBe(true);
    // H2H mini-table 3–3 → tied; no maps/rounds/wins separation → unresolved.
    expect(result.tieGroups).toHaveLength(1);
  });

  it("lets custom rule ordering change the outcome", () => {
    const teams = [t("a", "Falcons"), t("b", "Sentinels")];
    // A: 1W 1L = 3 pts, mapDiff -1. B: 1W 1L = 3 pts, mapDiff +1.
    const results = [win("a", "b", "b", [0, 2]), win("a", "b", "a", [2, 1])];
    const byMaps: ResolveInput = {
      teams,
      results,
      scoring: DEFAULT_SCORING,
      ruleOrder: ["points", "map_diff"],
    };
    expect(orderOf(byMaps)).toEqual(["b", "a"]);
    // Same data, wins after points: wins tied 1–1 → unresolved.
    const byWins: ResolveInput = { teams, results, scoring: DEFAULT_SCORING, ruleOrder: ["points", "wins"] };
    expect(resolveStandings(byWins).tieGroups).toHaveLength(1);
  });

  it("exposes the exact V1 preset orders", () => {
    expect(ROUND_ROBIN_ORDER).toEqual(["points", "h2h", "map_diff", "round_diff", "wins"]);
    expect(GROUP_STAGE_ORDER).toEqual(["points", "map_diff", "round_diff", "h2h", "wins"]);
    expect(SWISS_LITE_ORDER).toEqual(["points", "wins", "map_diff", "round_diff", "h2h"]);
  });

  it("never uses alphabetical order as a ranking rule", () => {
    // "Zebras" rightfully finish first; "Apples" must not jump ahead alphabetically.
    const teams = [t("z", "Zebras"), t("a", "Apples")];
    const input: ResolveInput = {
      teams,
      results: [win("z", "a", "z")],
      scoring: DEFAULT_SCORING,
      ruleOrder: ["points", "h2h", "map_diff", "round_diff", "wins"] as RuleId[],
    };
    expect(orderOf(input)).toEqual(["z", "a"]);
  });

  it("rejects invalid engine input with clear errors", () => {
    const teams = [t("a", "Falcons"), t("b", "Sentinels")];
    expect(() => resolveStandings({ teams: [teams[0] as Team], results: [], scoring: DEFAULT_SCORING, ruleOrder: ["points"] })).toThrow();
    expect(() =>
      resolveStandings({ teams, results: [], scoring: DEFAULT_SCORING, ruleOrder: [] }),
    ).toThrow("At least one ranking rule");
    expect(() =>
      resolveStandings({ teams, results: [], scoring: DEFAULT_SCORING, ruleOrder: ["nope" as RuleId] }),
    ).toThrow("Unknown ranking rule");
    expect(() =>
      resolveStandings({ teams, results: [win("a", "zzz", "a")], scoring: DEFAULT_SCORING, ruleOrder: ["points"] }),
    ).toThrow("unknown team");
  });
});
