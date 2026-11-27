// P5 tools route-boundary unit tests (pure, no network, no database).

import { describe, expect, it } from "vitest";
import { getToolBySlug, type ToolDefinition } from "@/features/tools/catalog";
import {
  buildToolDetailMetadata,
  buildToolNotFoundMetadata,
  buildToolsCanonicalUrl,
  buildToolsHref,
  buildToolsMetadata,
  getToolsAppBaseUrl,
  parseToolsQuery,
} from "./query";

const TOOL = getToolBySlug("prize-pool-splitter") as ToolDefinition;

describe("parseToolsQuery — valid filters", () => {
  it("defaults to an empty filter set", () => {
    const parsed = parseToolsQuery({});
    expect(parsed.filters).toEqual({});
    expect(parsed.invalid).toEqual([]);
  });

  it("passes valid filters through", () => {
    const parsed = parseToolsQuery({ game: "bgmi", category: "tournament-operations", query: "prize" });
    expect(parsed.filters).toEqual({
      game: "bgmi",
      category: "tournament-operations",
      query: "prize",
    });
    expect(parsed.invalid).toEqual([]);
  });

  it("treats empty-string params as absent, not invalid", () => {
    const parsed = parseToolsQuery({ game: "", category: "", query: "" });
    expect(parsed.filters).toEqual({});
    expect(parsed.invalid).toEqual([]);
  });

  it("takes the first value of repeated params", () => {
    const parsed = parseToolsQuery({ query: ["prize", "other"] });
    expect(parsed.filters.query).toBe("prize");
  });
});

describe("parseToolsQuery — invalid params fail safely", () => {
  it("drops malformed filters and keeps the valid ones", () => {
    const parsed = parseToolsQuery({ game: "BGMI!", category: "rumor", query: "z".repeat(121) });
    expect(parsed.filters).toEqual({});
    expect(parsed.invalid).toEqual(expect.arrayContaining(["game", "category", "query"]));
  });

  it("never throws on hostile input", () => {
    expect(() =>
      parseToolsQuery({ category: "<script>", query: "'; DROP TABLE x; --" }),
    ).not.toThrow();
  });
});

describe("buildToolsHref — filter preservation", () => {
  it("preserves valid filters", () => {
    expect(buildToolsHref({ game: "bgmi", category: "tournament-operations", query: "prize" })).toBe(
      "/tools?game=bgmi&category=tournament-operations&query=prize",
    );
  });

  it("returns the canonical directory URL with no filters", () => {
    expect(buildToolsHref({})).toBe("/tools");
  });

  it("encodes hostile filter values instead of reflecting them raw", () => {
    const href = buildToolsHref({ query: "<script>alert(1)</script>" });
    expect(href).not.toContain("<");
    expect(href).not.toContain(">");
    expect(href).toContain("/tools?query=%3Cscript%3E");
  });
});

describe("metadata builders — registry fields only", () => {
  it("builds the detail title and description from registry fields", () => {
    const copy = buildToolDetailMetadata(TOOL);
    expect(copy.title).toContain("Prize Pool Splitter");
    expect(copy.description).toBe(TOOL.description.slice(0, 160));
  });

  it("keeps directory and not-found copy generic (no PII, no existence signal)", () => {
    expect(buildToolsMetadata().title).toBe("Esports tools");
    expect(buildToolNotFoundMetadata().title).toBe("Tool not found");
  });
});

describe("canonical URLs — no invented domain", () => {
  it("returns undefined when no app URL is configured", () => {
    const previous = process.env["NEXT_PUBLIC_APP_URL"];
    delete process.env["NEXT_PUBLIC_APP_URL"];
    try {
      expect(getToolsAppBaseUrl()).toBeUndefined();
      expect(buildToolsCanonicalUrl("/tools/prize-pool-splitter")).toBeUndefined();
    } finally {
      if (previous !== undefined) {
        process.env["NEXT_PUBLIC_APP_URL"] = previous;
      }
    }
  });

  it("builds an absolute slug-based canonical when the app URL is configured", () => {
    const previous = process.env["NEXT_PUBLIC_APP_URL"];
    process.env["NEXT_PUBLIC_APP_URL"] = "https://esports.example.com";
    try {
      expect(buildToolsCanonicalUrl("/tools/prize-pool-splitter")).toBe(
        "https://esports.example.com/tools/prize-pool-splitter",
      );
    } finally {
      if (previous === undefined) {
        delete process.env["NEXT_PUBLIC_APP_URL"];
      } else {
        process.env["NEXT_PUBLIC_APP_URL"] = previous;
      }
    }
  });
});
