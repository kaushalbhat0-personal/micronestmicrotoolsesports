import { describe, expect, it } from "vitest";
import { resolveStandings, type ResolveInput } from "./resolve";
import type { CompetitionResult, Team } from "../types";
import { DEFAULT_SCORING } from "../types";

/**
 * Determinism hardening — same input, repeated executions, byte-identical
 * output. Mirrors the spirit of prize-splitter's calculation-hardening tests.
 */

function scenario(): ResolveInput {
  const teams: Team[] = [
    { id: "a", name: "Falcons" },
    { id: "b", name: "Sentinels" },
    { id: "c", name: "Wolves" },
    { id: "d", name: "Hawks" },
  ];
  const results: CompetitionResult[] = [
    { id: "r1", teamAId: "a", teamBId: "b", outcome: { kind: "win", winnerTeamId: "a" }, mapsA: 2, mapsB: 1, roundsA: 30, roundsB: 22, isComplete: true },
    { id: "r2", teamAId: "b", teamBId: "c", outcome: { kind: "win", winnerTeamId: "b" }, mapsA: 2, mapsB: 0, roundsA: 26, roundsB: 14, isComplete: true },
    { id: "r3", teamAId: "c", teamBId: "a", outcome: { kind: "win", winnerTeamId: "c" }, mapsA: 2, mapsB: 1, roundsA: 28, roundsB: 24, isComplete: true },
    { id: "r4", teamAId: "a", teamBId: "d", outcome: { kind: "win", winnerTeamId: "a" }, mapsA: 2, mapsB: 0, isComplete: true },
    { id: "r5", teamAId: "b", teamBId: "d", outcome: { kind: "win", winnerTeamId: "b" }, mapsA: 2, mapsB: 0, isComplete: true },
    { id: "r6", teamAId: "c", teamBId: "d", outcome: { kind: "win", winnerTeamId: "c" }, mapsA: 2, mapsB: 0, isComplete: true },
    { id: "rx", teamAId: "a", teamBId: "c", outcome: { kind: "win", winnerTeamId: "a" }, isComplete: false },
  ];
  return { teams, results, scoring: DEFAULT_SCORING, ruleOrder: ["points", "h2h", "map_diff", "round_diff", "wins"] };
}

describe("resolveStandings determinism hardening", () => {
  it("produces identical output across 100 executions", () => {
    const first = resolveStandings(scenario());
    const baseline = JSON.stringify(first);
    for (let i = 0; i < 100; i++) {
      expect(JSON.stringify(resolveStandings(scenario()))).toBe(baseline);
    }
  });

  it("keeps positions, decisive rules, explanations, and tie groups stable", () => {
    const a = resolveStandings(scenario());
    const b = resolveStandings(scenario());
    expect(b.entries.map((e) => [e.teamId, e.position, e.decisiveRule])).toEqual(
      a.entries.map((e) => [e.teamId, e.position, e.decisiveRule]),
    );
    expect(b.tieGroups).toEqual(a.tieGroups);
    expect(b.explanations.map((e) => e.summary)).toEqual(a.explanations.map((e) => e.summary));
    expect(b.evaluations).toEqual(a.evaluations);
  });

  it("is independent of input team order for resolved positions", () => {
    const base = scenario();
    const reversed: ResolveInput = { ...base, teams: [...base.teams].reverse() };
    const r1 = resolveStandings(base);
    const r2 = resolveStandings(reversed);
    expect(r2.entries.map((e) => e.teamId)).toEqual(r1.entries.map((e) => e.teamId));
  });

  it("embeds no timestamps or random values in output", () => {
    const out = JSON.stringify(resolveStandings(scenario()));
    expect(out).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
