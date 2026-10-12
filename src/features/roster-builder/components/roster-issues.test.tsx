import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RosterIssues } from "./roster-issues";
import { type IssueCode } from "../types";
import { parseRosterText } from "../services/parser";
import { detectConflicts } from "../services/conflicts";

const ALL_CODES: ReadonlyArray<IssueCode> = [
  "oversized-input",
  "missing-team",
  "missing-player",
  "player-multiple-teams",
  "team-over-capacity",
  "duplicate-row-exact",
  "duplicate-player-same-team",
  "duplicate-team-name",
  "malformed-row",
  "empty-team",
  "extra-columns-ignored",
  "value-too-long",
];

function issuesFor(text: string, teamCapacity = 5) {
  const parsed = parseRosterText(text);
  if (!parsed.ok) throw new Error("fixture must parse");
  return detectConflicts(parsed.rows, { teamCapacity });
}

/** React 19 SSR emits `<!-- -->` between adjacent text/expressions. */
function rendered(element: React.ReactElement): string {
  return renderToString(element).replace(/<!-- -->/g, "");
}

describe("RosterIssues", () => {
  it("renders nothing for a clean roster", () => {
    expect(rendered(<RosterIssues issues={[]} />)).toBe("");
  });

  it("groups blocking first with human language, never internal codes", () => {
    const html = rendered(
      <RosterIssues issues={issuesFor("Alpha\tRahul\nAlpha\tRahul\n\tKaran")} />,
    );
    expect(html).toContain("Needs decision");
    expect(html).toContain("Review");
    expect(html).toContain("team is missing");
    for (const code of ALL_CODES) {
      expect(html).not.toContain(code);
    }
  });

  it("separates review and info with distinct headings", () => {
    const html = rendered(
      <RosterIssues issues={issuesFor("Alpha\tRahul\nAlpha\tRahul\nBravo\tKaran\tx\textra\textra2")} />,
    );
    expect(html).toContain("Review");
    expect(html).toContain("Notes");
    expect(html).not.toContain("Needs decision");
  });

  it("carries source line references for multi-line issues", () => {
    const html = rendered(<RosterIssues issues={issuesFor("Alpha\tRahul\nBravo\tRahul")} />);
    expect(html).toContain("Rahul");
    expect(html).toContain("Lines 1, 2");
  });
});
