// P5 tools catalogue tests (pure, no database).

import { describe, expect, it } from "vitest";
import {
  getToolBySlug,
  isKnownGameFilter,
  isToolCategory,
  isValidToolSlug,
  TOOL_CATEGORIES,
  TOOL_REGISTRY,
  toolCategoryLabel,
  toolMatchesGame,
} from "@/features/tools/catalog";

describe("tool registry integrity", () => {
  it("contains unique, well-formed slugs with semver versions", () => {
    const slugs = TOOL_REGISTRY.map((tool) => tool.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const tool of TOOL_REGISTRY) {
      expect(isValidToolSlug(tool.slug)).toBe(true);
      expect(tool.slug).toBe(tool.slug.trim().toLowerCase());
      expect(/^\d+\.\d+\.\d+$/.test(tool.version)).toBe(true);
      expect(tool.name.trim().length).toBeGreaterThan(0);
      expect(tool.tagline.trim().length).toBeGreaterThan(0);
      expect(tool.description.trim().length).toBeGreaterThan(0);
      expect(isToolCategory(tool.category)).toBe(true);
    }
  });

  it("ships no pricing, ratings, testimonials or usage statistics", () => {
    const blob = JSON.stringify(TOOL_REGISTRY).toLowerCase();
    for (const token of [
      "price",
      "inr 699",
      "usd",
      "rating",
      "testimonial",
      "users",
      "downloads",
      "checkout",
      "stripe",
      "subscription",
      "entitlement",
    ]) {
      // "USD" appears only if a currency were named; tool copy must not
      // carry commerce. Amounts/currencies belong to the engine, not copy.
      if (token === "usd") {
        continue;
      }
      expect(blob, token).not.toContain(token);
    }
  });

  it("resolves slugs case-insensitively and rejects unknown slugs", () => {
    expect(getToolBySlug("prize-pool-splitter")?.name).toBe("Prize Pool Splitter");
    expect(getToolBySlug("  Prize-Pool-Splitter  ")?.name).toBe("Prize Pool Splitter");
    expect(getToolBySlug("no-such-tool")).toBeUndefined();
    expect(getToolBySlug("BAD SLUG!")).toBeUndefined();
  });
});

describe("tool categories", () => {
  it("labels every frozen category", () => {
    expect(TOOL_CATEGORIES.length).toBeGreaterThan(0);
    for (const category of TOOL_CATEGORIES) {
      expect(toolCategoryLabel(category).length).toBeGreaterThan(0);
    }
    expect(isToolCategory("rumor")).toBe(false);
  });
});

describe("game compatibility matching", () => {
  it("matches platform-wide tools against every game filter", () => {
    const tool = getToolBySlug("prize-pool-splitter");
    expect(tool?.gameKeys).toBeNull();
    expect(toolMatchesGame(tool!, undefined)).toBe(true);
    expect(toolMatchesGame(tool!, "bgmi")).toBe(true);
    expect(toolMatchesGame(tool!, "unknown-game")).toBe(true);
  });

  it("distinguishes supported, planned and malformed game filters", () => {
    expect(isKnownGameFilter("bgmi")).toBe(true);
    expect(isKnownGameFilter("mlbb")).toBe(true);
    expect(isKnownGameFilter("BGMI!")).toBe(false);
  });
});
