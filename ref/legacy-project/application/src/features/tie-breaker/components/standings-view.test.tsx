import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ExplanationSummary, StandingsView } from "./standings-view";
import type { StandingsResult } from "../types";

const teamNames = { a: "Falcons", b: "Sentinels", c: "Wolves" };

function resolved(): StandingsResult {
  return {
    entries: [
      { teamId: "a", position: 1, points: 6, wins: 2, draws: 0, losses: 0, mapDiff: 3, roundDiff: 8, decisiveRule: "map_diff", tied: false, tiedWith: [] },
      { teamId: "b", position: 2, points: 6, wins: 2, draws: 0, losses: 0, mapDiff: 1, roundDiff: 2, decisiveRule: "map_diff", tied: false, tiedWith: [] },
      { teamId: "c", position: 3, points: 0, wins: 0, draws: 0, losses: 2, mapDiff: -4, roundDiff: -10, tied: false, tiedWith: [] },
    ],
    tieGroups: [],
    evaluations: [],
    explanations: [
      {
        scope: "separation",
        teamIds: ["a", "b"],
        checkedRules: [],
        decisiveRule: "map_diff",
        summary: "Falcons and Sentinels finished on 6 points. Map difference therefore placed Falcons above Sentinels (+3 vs +1).",
      },
    ],
    rulesApplied: ["points", "h2h", "map_diff"],
    engineVersion: "tie-breaker-engine/1",
  };
}

function withUnresolved(): StandingsResult {
  const base = resolved();
  return {
    ...base,
    entries: base.entries.map((e) => (e.teamId === "c" ? e : { ...e, tied: e.teamId === "a" || e.teamId === "b", tiedWith: e.teamId === "a" ? ["b"] : e.teamId === "b" ? ["a"] : [] })),
    tieGroups: [{ memberIds: ["a", "b"], reason: "These teams remain tied under the configured rules" }],
    explanations: [
      ...base.explanations,
      {
        scope: "unresolved",
        teamIds: ["a", "b"],
        checkedRules: [],
        summary: "Falcons and Sentinels remain tied under your current rules.",
      },
    ],
  };
}

describe("StandingsView", () => {
  it("renders positions, teams, and points", () => {
    const html = renderToString(<StandingsView standings={resolved()} teamNames={teamNames} />);
    expect(html).toContain("Falcons");
    expect(html).toContain("Sentinels");
    expect(html).toContain("Separated by Map difference");
  });

  it("offers explanations behind an accessible disclosure", () => {
    const html = renderToString(<StandingsView standings={resolved()} teamNames={teamNames} />);
    expect(html).toContain("Why this position?");
    expect(html).toContain('aria-expanded="false"');
  });

  it("renders explanation facts with compared values", () => {
    const html = renderToString(
      <ExplanationSummary text="Falcons and Sentinels finished on 6 points. Map difference therefore placed Falcons above Sentinels (+3 vs +1)." />,
    );
    expect(html).toContain("+3 vs +1");
  });

  it("marks unresolved ties without inventing an order", () => {
    const html = renderToString(<StandingsView standings={withUnresolved()} teamNames={teamNames} />);
    expect(html).toContain("Still tied");
    expect(html).toContain("Tie detected");
    expect(html).toContain("alphabetical for display only");
  });

  it("shows an empty state with no entries", () => {
    const html = renderToString(
      <StandingsView
        standings={{ entries: [], tieGroups: [], evaluations: [], explanations: [], rulesApplied: [], engineVersion: "" }}
        teamNames={{}}
      />,
    );
    expect(html).toContain("No standings yet");
  });
});
