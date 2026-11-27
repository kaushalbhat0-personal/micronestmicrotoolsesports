import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RosterSession } from "./roster-session";
import { SAMPLE_ROSTER_INPUT } from "./roster-input";
import { parseRosterText } from "../services/parser";

function rows() {
  const parsed = parseRosterText(SAMPLE_ROSTER_INPUT);
  if (!parsed.ok) throw new Error("sample must parse");
  return parsed.rows;
}

/** React 19 SSR emits `<!-- -->` between adjacent text/expressions. */
function rendered(element: React.ReactElement): string {
  return renderToString(element).replace(/<!-- -->/g, "");
}

describe("RosterSession", () => {
  it("composes summary, issues, teams, and output for the sample", () => {
    const html = rendered(<RosterSession rows={rows()} teamCapacity={5} delimiter="," delimiterDetected onReset={() => undefined} />);
    expect(html).toContain("3 teams");
    expect(html).toContain("8 players");
    expect(html).toContain("Needs decision");
    expect(html).toContain("Rahul Patil");
    expect(html).toContain("Team 1 — Alpha Esports");
    expect(html).toContain("Copy roster");
    expect(html).toContain("Export CSV");
    expect(html).toContain("Print");
  });

  it("re-evaluates capacity without touching teams", () => {
    const tight = rendered(<RosterSession rows={rows()} teamCapacity={2} delimiter="," delimiterDetected onReset={() => undefined} />);
    expect(tight).toContain("Over capacity");
    const loose = rendered(<RosterSession rows={rows()} teamCapacity={5} delimiter="," delimiterDetected onReset={() => undefined} />);
    expect(loose).not.toContain("Over capacity");
    expect(loose).toContain("Team 1 — Alpha Esports");
  });

  it("shows the unresolved banner while blocking issues stand", () => {
    const html = rendered(<RosterSession rows={rows()} teamCapacity={5} delimiter="," delimiterDetected onReset={() => undefined} />);
    expect(html).toContain("Unresolved:");
    expect(html).toContain("blocking");
  });
});
