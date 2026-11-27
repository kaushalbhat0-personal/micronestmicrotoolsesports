import { describe, expect, it } from "vitest";
import { parseToolIntent, toolDisplayName, toolWorkspaceRoute } from "./tool-intent";

describe("parseToolIntent (RCCF F6 allowlist)", () => {
  it("accepts every commercially available registry slug", () => {
    for (const slug of ["sponsor-sentinel", "prize-splitter", "draft-ban", "tie-breaker", "payout-tracker", "roster-builder"]) {
      expect(parseToolIntent(slug)).toBe(slug);
    }
  });

  it("normalizes case and surrounding whitespace", () => {
    expect(parseToolIntent("  Tie-Breaker ")).toBe("tie-breaker");
  });

  it("rejects unknown slugs, paths, URLs, and non-strings (no open redirect)", () => {
    expect(parseToolIntent("all-access")).toBeNull();
    expect(parseToolIntent("nonexistent-tool")).toBeNull();
    expect(parseToolIntent("/dashboard/evil")).toBeNull();
    expect(parseToolIntent("https://evil.example")).toBeNull();
    expect(parseToolIntent("../../etc")).toBeNull();
    expect(parseToolIntent("")).toBeNull();
    expect(parseToolIntent(undefined)).toBeNull();
    expect(parseToolIntent(null)).toBeNull();
    expect(parseToolIntent(42)).toBeNull();
    expect(parseToolIntent("prize-splitter ".repeat(20))).toBeNull();
  });
});

describe("toolDisplayName", () => {
  it("returns the customer-facing name for valid slugs, null otherwise", () => {
    expect(toolDisplayName("prize-splitter")).toBe("Prize Pool Splitter");
    expect(toolDisplayName("sponsor-sentinel")).toBe("Sponsorship Tracking");
    expect(toolDisplayName("evil")).toBeNull();
  });
});

describe("toolWorkspaceRoute", () => {
  it("routes Sponsorship Tracking to its campaigns entry, others to the tool root", () => {
    expect(toolWorkspaceRoute("acme", "sponsor-sentinel")).toBe("/dashboard/acme/sponsor-sentinel/campaigns");
    expect(toolWorkspaceRoute("acme", "prize-splitter")).toBe("/dashboard/acme/prize-splitter");
    expect(toolWorkspaceRoute("acme", "tie-breaker")).toBe("/dashboard/acme/tie-breaker");
  });

  it("never produces an off-site URL", () => {
    for (const slug of ["prize-splitter", "sponsor-sentinel"]) {
      const href = toolWorkspaceRoute("acme", slug);
      expect(href.startsWith("/dashboard/acme/")).toBe(true);
      expect(href).not.toContain("://");
    }
  });
});
