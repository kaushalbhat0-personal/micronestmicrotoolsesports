// P6 roster tool registry + presentation tests (no database, no network).
// Covers: catalogue discovery of roster-slot-builder, directory filtering by
// BGMI game and team-management category, invalid-slug behavior, and the
// runner's initial keyboard-accessible UI. Prize Pool Splitter assertions
// elsewhere are untouched.

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
import { RosterBuilderRunner } from "@/app/tools/[slug]/_components/roster-builder-runner";

describe("roster-slot-builder registry entry", () => {
  it("is discoverable with a stable, versioned definition", () => {
    const tool = getToolBySlug("roster-slot-builder");
    expect(tool?.name).toBe("Roster & Slot Builder");
    expect(tool?.category).toBe("team-management");
    expect(isToolCategory(tool?.category)).toBe(true);
    expect(tool?.gameKeys).toEqual(["bgmi"]);
    expect(tool?.availability).toBe("available");
    expect(tool?.version).toBe("1.0.0");
  });

  it("keeps the registry free of commerce and tracking copy", () => {
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
    ]) {
      expect(blob, token).not.toContain(token);
    }
  });

  it("matches BGMI filters and stays hidden from unrelated game filters", () => {
    const tool = getToolBySlug("roster-slot-builder")!;
    expect(toolMatchesGame(tool, undefined)).toBe(true);
    expect(toolMatchesGame(tool, "bgmi")).toBe(true);
    expect(toolMatchesGame(tool, "valorant")).toBe(false);
  });

  it("leaves the splitter definition untouched", () => {
    expect(getToolBySlug("prize-pool-splitter")?.gameKeys).toBeNull();
    expect(getToolBySlug("prize-pool-splitter")?.version).toBe("1.0.0");
  });
});

describe("directory discovery", () => {
  it("lists both tools and narrows by game and category", () => {
    const all = renderToStaticMarkup(<ToolsResults parsed={parseToolsQuery({})} />);
    expect(all).toContain("/tools/prize-pool-splitter");
    expect(all).toContain("/tools/roster-slot-builder");
    expect(all).toContain("Showing 3 tools.");

    const bgmi = renderToStaticMarkup(<ToolsResults parsed={parseToolsQuery({ game: "bgmi" })} />);
    expect(bgmi).toContain("/tools/roster-slot-builder");
    expect(bgmi).toContain("/tools/prize-pool-splitter");

    const teamMgmt = renderToStaticMarkup(
      <ToolsResults parsed={parseToolsQuery({ category: "team-management" })} />,
    );
    expect(teamMgmt).toContain("/tools/roster-slot-builder");
    expect(teamMgmt).not.toContain("/tools/prize-pool-splitter");
  });

  it("still reports no match honestly for unknown queries", () => {
    const none = renderToStaticMarkup(
      <ToolsResults parsed={parseToolsQuery({ query: "no-such-tool-xyz" })} />,
    );
    expect(none).toContain("No tools found");
  });
});

describe("RosterBuilderRunner — initial execution UI", () => {
  it("renders labelled setup, add-player, and action controls", () => {
    const html = renderToStaticMarkup(<RosterBuilderRunner />);
    expect(html).toContain("Roster plan");
    expect(html).toContain("Team name");
    expect(html).toContain("Starter slots");
    expect(html).toContain("Substitute slots");
    expect(html).toContain("Add a player");
    expect(html).toContain("Display name");
    expect(html).toContain("Add player");
    expect(html).toContain("Roster summary");
    expect(html).toContain("Copy summary");
    expect(html).toContain("Reset");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Starter slots filled");
  });

  it("starts empty with an honest status and no result claims", () => {
    const html = renderToStaticMarkup(<RosterBuilderRunner />);
    expect(html).toContain("No players yet");
    expect(html).toContain("Empty — add your first player below.");
    expect(html).toContain("User-created plan only");
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });

  it("uses card layout with responsive grid (no table-only interaction)", () => {
    const html = renderToStaticMarkup(<RosterBuilderRunner />);
    expect(html).toContain("sm:grid-cols-2");
    expect(html).not.toContain("<table");
  });
});
