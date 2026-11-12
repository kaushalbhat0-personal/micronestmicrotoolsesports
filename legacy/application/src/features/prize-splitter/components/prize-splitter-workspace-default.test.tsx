import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { PrizeSplitterCalculator } from "./prize-splitter-calculator";

/** React 19 SSR emits `<!-- -->` between adjacent text/expressions. */
function rendered(element: React.ReactElement): string {
  return renderToString(element).replace(/<!-- -->/g, "");
}

describe("PrizeSplitterCalculator workspace default (RCCF F2)", () => {
  it("prefills the tournament name in the authenticated workspace", () => {
    const html = rendered(<PrizeSplitterCalculator defaultTournamentName="TAG Esports" />);
    expect(html).toContain('id="tournament-name"');
    expect(html).toContain('value="TAG Esports"');
  });

  it("starts empty without a default (anonymous demo unchanged)", () => {
    const html = rendered(<PrizeSplitterCalculator />);
    const match = html.match(/id="tournament-name"[^>]*value="([^"]*)"/);
    expect(match?.[1] ?? null).toBe("");
  });
});
