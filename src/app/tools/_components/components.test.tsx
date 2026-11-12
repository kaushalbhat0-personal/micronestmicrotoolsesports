// P5 tools presentation tests (renderToStaticMarkup, no network).
// Covers cards, filters, landing copy, and the runner's initial,
// keyboard-accessible, mobile-first UI. No fabricated metrics anywhere.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getToolBySlug, type ToolDefinition } from "@/features/tools/catalog";
import { ToolCard } from "./tool-card";
import { ToolsFilters } from "./tools-filters";
import { ToolsResults } from "./tools-results";
import { parseToolsQuery } from "../_lib/query";
import { PrizePoolRunner } from "../[slug]/_components/prize-pool-runner";

const TOOL = getToolBySlug("prize-pool-splitter") as ToolDefinition;

describe("ToolCard", () => {
  it("links to the slug route with name, tagline and availability", () => {
    const html = renderToStaticMarkup(<ToolCard tool={TOOL} />);
    expect(html).toContain('href="/tools/prize-pool-splitter"');
    expect(html).toContain("Prize Pool Splitter");
    expect(html).toContain("Available now");
    expect(html).toContain("Platform-wide");
  });

  it("renders a coming-soon marker for unreleased tools (test fixture only)", () => {
    const planned: ToolDefinition = { ...TOOL, slug: "test-planned-tool", availability: "coming-soon" };
    const html = renderToStaticMarkup(<ToolCard tool={planned} />);
    expect(html).toContain("Coming soon");
    expect(html).not.toContain("Available now");
  });

  it("ships no fabricated metrics, ratings or testimonials", () => {
    const html = renderToStaticMarkup(<ToolCard tool={TOOL} />);
    for (const token of ["rating", "testimonial", "users", "downloads", "★"]) {
      expect(html.toLowerCase(), token).not.toContain(token);
    }
  });
});

describe("ToolsFilters + ToolsResults", () => {
  it("renders labelled search/game controls as a GET form", () => {
    const html = renderToStaticMarkup(<ToolsFilters filters={{ game: "bgmi", query: "prize" }} />);
    expect(html).toContain('method="get"');
    expect(html).toContain('action="/tools"');
    expect(html).toContain('aria-label="Filter tools"');
    expect(html).toContain("Search tools");
  });

  it("lists the functional tool and filters honestly", () => {
    const all = renderToStaticMarkup(<ToolsResults parsed={parseToolsQuery({})} />);
    expect(all).toContain("/tools/prize-pool-splitter");
    expect(all).toContain("Showing 3 tools.");
    const none = renderToStaticMarkup(
      <ToolsResults parsed={parseToolsQuery({ query: "no-such-tool-xyz" })} />,
    );
    expect(none).toContain("No tools found");
    expect(none).toContain("Reset filters");
  });

  it("matches platform-wide tools against game filters", () => {
    const html = renderToStaticMarkup(
      <ToolsResults parsed={parseToolsQuery({ game: "bgmi" })} />,
    );
    expect(html).toContain("/tools/prize-pool-splitter");
  });
});

describe("PrizePoolRunner — initial execution UI", () => {
  it("renders labelled inputs, example rows, and action buttons", () => {
    const html = renderToStaticMarkup(<PrizePoolRunner />);
    expect(html).toContain("Total prize pool");
    expect(html).toContain("Currency");
    expect(html).toContain("Payout rows");
    expect(html).toContain("Calculate breakdown");
    expect(html).toContain("Reset");
    expect(html).toContain("Add payout row");
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('aria-live="polite"');
  });

  it("states the planning-only boundary before any calculation", () => {
    const html = renderToStaticMarkup(<PrizePoolRunner />);
    expect(html).not.toContain("Calculated breakdown");
    // The boundary note lives in the landing guidance; the runner never
    // implies payments. Static shell carries no result markup initially.
    expect(html).not.toContain("not a payment");
  });

  it("uses a responsive grid for rows (mobile-first, no dashboard chrome)", () => {
    const html = renderToStaticMarkup(<PrizePoolRunner />);
    expect(html).toContain("sm:grid-cols-");
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });
});
