// P7 tiebreak tool registry + presentation tests (no database, no network).
// Covers: catalogue discovery, directory filtering (platform-wide matching,
// scoring category, search), invalid-slug behavior, and the runner's initial
// UI. P5/P6 assertions elsewhere are untouched.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  TOOL_REGISTRY,
  getToolBySlug,
  isToolCategory,
  toolMatchesGame,
} from "@/features/tools/catalog";
import { ToolsResults } from "@/app/tools/_components/tools-results";
import { parseToolsQuery } from "@/app/tools/_lib/query";
import { TiebreakRunner } from "@/app/tools/[slug]/_components/tiebreak-runner";

describe("tiebreak-qualifier registry entry", () => {
  it("is discoverable with a stable, versioned, platform-wide definition", () => {
    const tool = getToolBySlug("tiebreak-qualifier");
    expect(tool?.name).toBe("Tie-Break & Qualification Simulator");
    expect(tool?.category).toBe("scoring");
    expect(isToolCategory(tool?.category)).toBe(true);
    expect(tool?.gameKeys).toBeNull();
    expect(tool?.availability).toBe("available");
    expect(tool?.version).toBe("1.0.0");
  });

  it("keeps the registry free of commerce, tracking, and official-results copy", () => {
    expect(TOOL_REGISTRY).toHaveLength(3);
    const blob = JSON.stringify(TOOL_REGISTRY).toLowerCase();
    for (const token of [
      "price",
      "rating",
      "testimonial",
      "users",
      "downloads",
      "checkout",
      "stripe",
      "subscription",
      "entitlement",
      "official result",
      "verified",
    ]) {
      expect(blob, token).not.toContain(token);
    }
  });

  it("matches every game filter as a platform-wide tool", () => {
    const tool = getToolBySlug("tiebreak-qualifier")!;
    expect(toolMatchesGame(tool, undefined)).toBe(true);
    expect(toolMatchesGame(tool, "bgmi")).toBe(true);
    expect(toolMatchesGame(tool, "unknown-game")).toBe(true);
  });

  it("leaves the P5/P6 definitions untouched", () => {
    expect(getToolBySlug("prize-pool-splitter")?.version).toBe("1.0.0");
    expect(getToolBySlug("prize-pool-splitter")?.gameKeys).toBeNull();
    expect(getToolBySlug("roster-slot-builder")?.version).toBe("1.0.0");
    expect(getToolBySlug("roster-slot-builder")?.gameKeys).toEqual(["bgmi"]);
  });
});

describe("directory discovery", () => {
  it("lists all three tools and narrows by category and search", () => {
    const all = renderToStaticMarkup(<ToolsResults parsed={parseToolsQuery({})} />);
    expect(all).toContain("/tools/prize-pool-splitter");
    expect(all).toContain("/tools/roster-slot-builder");
    expect(all).toContain("/tools/tiebreak-qualifier");
    expect(all).toContain("Showing 3 tools.");

    const scoring = renderToStaticMarkup(
      <ToolsResults parsed={parseToolsQuery({ category: "scoring" })} />,
    );
    expect(scoring).toContain("/tools/tiebreak-qualifier");
    expect(scoring).not.toContain("/tools/prize-pool-splitter");
    expect(scoring).not.toContain("/tools/roster-slot-builder");

    const search = renderToStaticMarkup(
      <ToolsResults parsed={parseToolsQuery({ query: "tie-break" })} />,
    );
    expect(search).toContain("/tools/tiebreak-qualifier");

    const bgmi = renderToStaticMarkup(<ToolsResults parsed={parseToolsQuery({ game: "bgmi" })} />);
    expect(bgmi).toContain("/tools/tiebreak-qualifier");
  });

  it("still reports no match honestly for unknown queries", () => {
    const none = renderToStaticMarkup(
      <ToolsResults parsed={parseToolsQuery({ query: "no-such-tool-xyz" })} />,
    );
    expect(none).toContain("No tools found");
  });
});

describe("TiebreakRunner — initial execution UI", () => {
  it("renders labelled scenario, criteria, team, and action controls", () => {
    const html = renderToStaticMarkup(<TiebreakRunner />);
    expect(html).toContain("Scenario");
    expect(html).toContain("Qualification cutoff");
    expect(html).toContain("Scoring criteria");
    expect(html).toContain("Add criterion");
    expect(html).toContain("Teams");
    expect(html).toContain("Add team");
    expect(html).toContain("Standings");
    expect(html).toContain("What-if snapshots");
    expect(html).toContain("Save snapshot");
    expect(html).toContain("Scenario summary");
    expect(html).toContain("Copy summary");
    expect(html).toContain("Reset");
    expect(html).toContain('aria-live="polite"');
  });

  it("starts empty with simulation-only labelling and no result claims", () => {
    const html = renderToStaticMarkup(<TiebreakRunner />);
    expect(html).toContain("No teams yet");
    expect(html).toContain("Standings appear here once teams are added");
    expect(html).toContain("Not an official tournament result");
    expect(html).toContain("User-created simulation only");
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });

  it("uses card layout with responsive grid (no table-only interaction)", () => {
    const html = renderToStaticMarkup(<TiebreakRunner />);
    expect(html).toContain("sm:grid-cols-2");
    expect(html).not.toContain("<table");
  });
});
