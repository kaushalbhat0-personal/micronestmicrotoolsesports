import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RosterSummary } from "./roster-summary";

/** React 19 SSR emits `<!-- -->` between adjacent text/expressions. */
function rendered(element: React.ReactElement): string {
  return renderToString(element).replace(/<!-- -->/g, "");
}

describe("RosterSummary", () => {
  it("reports teams, players, and delimiter with a clean badge", () => {
    const html = rendered(
      <RosterSummary
        stats={{ dataRows: 4, teams: 2, players: 4 }}
        delimiter=","
        delimiterDetected
        summary={{ blocking: 0, review: 0, info: 0, total: 0 }}
      />,
    );
    expect(html).toContain("2 teams");
    expect(html).toContain("4 players");
    expect(html).toContain("Detected comma-separated");
    expect(html).toContain("Roster clean");
  });

  it("flags blocking counts prominently with icon and text (never color-only)", () => {
    const html = rendered(
      <RosterSummary
        stats={{ dataRows: 4, teams: 2, players: 4 }}
        delimiter={"\t"}
        delimiterDetected={false}
        summary={{ blocking: 2, review: 1, info: 1, total: 4 }}
      />,
    );
    expect(html).toContain("2 must fixes");
    expect(html).toContain("1 to review");
    expect(html).toContain("1 note");
    expect(html).toContain("Using tab-separated");
    expect(html).not.toContain("Roster clean");
  });

  it("singularizes counts and announces through a live region", () => {
    const html = rendered(
      <RosterSummary
        stats={{ dataRows: 1, teams: 1, players: 1 }}
        delimiter={"\t"}
        delimiterDetected
        summary={{ blocking: 1, review: 0, info: 0, total: 1 }}
      />,
    );
    expect(html).toContain("1 team");
    expect(html).toContain("1 player");
    expect(html).toContain("1 must fix");
    expect(html).toContain("aria-live");
  });
});
