import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { ReviewChecklist } from "./review-checklist";

describe("ReviewChecklist", () => {
  it("confirms a ready competition", () => {
    const html = renderToString(
      <ReviewChecklist
        summary={{
          teamCount: 4,
          completeCount: 6,
          incompleteCount: 0,
          ruleOrder: ["points", "h2h"],
          scoringLine: "Win 3 · Draw 1 · Loss 0",
          standings: { entries: [], tieGroups: [], evaluations: [], explanations: [], rulesApplied: [], engineVersion: "" },
          teamNames: {},
        }}
      />,
    );
    expect(html).toContain("4 teams");
    expect(html).toContain("6 completed results");
    expect(html).toContain("No incomplete results");
    expect(html).toContain("No unresolved ties");
    expect(html).toContain("Points → Head-to-head");
  });

  it("warns about incomplete results and unresolved ties with names", () => {
    const html = renderToString(
      <ReviewChecklist
        summary={{
          teamCount: 3,
          completeCount: 2,
          incompleteCount: 1,
          ruleOrder: ["points"],
          scoringLine: "Win 3 · Draw 1 · Loss 0",
          standings: {
            entries: [],
            tieGroups: [{ memberIds: ["a", "b"], reason: "tied" }],
            evaluations: [],
            explanations: [],
            rulesApplied: [],
            engineVersion: "",
          },
          teamNames: { a: "Falcons", b: "Sentinels" },
        }}
      />,
    );
    expect(html).toContain("1 incomplete result");
    expect(html).toContain("Falcons, Sentinels");
  });
});
