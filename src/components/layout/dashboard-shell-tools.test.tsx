import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { DashboardShell } from "./dashboard-shell";
import type { WorkspaceTool } from "@/server/services/workspace-tools";

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    useParams: () => ({ orgSlug: "acme" }),
    usePathname: () => "/dashboard/acme",
  };
});

function tool(overrides: Partial<WorkspaceTool> & { slug: string }): WorkspaceTool {
  return {
    name: overrides.slug,
    internalSlug: overrides.slug,
    description: "Test tool",
    icon: "Split",
    href: `/dashboard/acme/${overrides.slug}` as never,
    entitled: true,
    comingSoon: false,
    ...overrides,
  } as WorkspaceTool;
}

function shellHtml(): string {
  const workspaceToolsBySlug = {
    acme: {
      entitled: [
        tool({
          slug: "sponsor-sentinel",
          name: "Sponsorship Tracking",
          href: "/dashboard/acme/sponsor-sentinel/campaigns" as never,
          subItems: [
            {
              label: "Campaigns",
              href: "/dashboard/acme/sponsor-sentinel/campaigns" as never,
              icon: "ShieldCheck",
            },
            {
              label: "Checks",
              href: "/dashboard/acme/sponsor-sentinel/scans" as never,
              icon: "History",
            },
          ],
        }),
        tool({ slug: "prize-splitter", name: "Prize Pool Splitter" }),
        tool({ slug: "tie-breaker", name: "Tie-Breaker Resolver" }),
      ],
      available: [],
    },
  };
  return renderToString(
    <DashboardShell
      organizations={[{ id: "org-1", name: "Acme", slug: "acme" }]}
      workspaceToolsBySlug={workspaceToolsBySlug}
      primaryOrgId={null}
    >
      {null}
    </DashboardShell>
  );
}

function countOccurrences(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe("dashboard sidebar — each tool rendered exactly once per nav copy (RCCF F10)", () => {
  it("single-page tools show one label per nav copy (no header + duplicate link)", () => {
    const html = shellHtml();
    const splitter = countOccurrences(html, "Prize Pool Splitter");
    const tieBreaker = countOccurrences(html, "Tie-Breaker Resolver");
    // SSR renders a single nav copy (desktop aside; the mobile sheet portals
    // on the client). The F10 bug rendered a header AND a link per copy, so
    // any duplication fails here.
    expect(splitter).toBe(1);
    expect(tieBreaker).toBe(1);
  });

  it("grouped tools keep one header plus distinct sub-page links", () => {
    const html = shellHtml();
    expect(countOccurrences(html, "Sponsorship Tracking")).toBeLessThanOrEqual(2);
    expect(html).toContain("Campaigns");
    expect(html).toContain("Checks");
  });
});
