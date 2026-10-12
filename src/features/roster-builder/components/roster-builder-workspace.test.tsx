import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RosterBuilderWorkspace } from "./roster-builder-workspace";

/** React 19 SSR emits `<!-- -->` between adjacent text/expressions. */
function rendered(element: React.ReactElement): string {
  return renderToString(element).replace(/<!-- -->/g, "");
}

describe("RosterBuilderWorkspace", () => {
  it("opens on an empty state that answers what/why/next", () => {
    const html = rendered(<RosterBuilderWorkspace />);
    expect(html).toContain("Paste to build your slot list");
    expect(html).toContain('id="roster-paste"');
    expect(html).toContain("Load sample");
    expect(html).toContain("Players per team");
    expect(html).toContain("Delimiter");
    expect(html).toContain("Nothing leaves your browser");
  });

  it("renders no session, issues, or output before input", () => {
    const html = rendered(<RosterBuilderWorkspace />);
    expect(html).not.toContain("Final roster");
    expect(html).not.toContain("Working roster");
    expect(html).not.toContain("Roster issues");
  });
});
