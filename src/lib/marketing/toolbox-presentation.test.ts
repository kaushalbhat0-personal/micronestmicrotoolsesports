import { describe, expect, it } from "vitest";
import { TOOLS } from "@/config/app/tools";
import { MARKETING_TOOLS } from "@/config/marketing/tools";
import {
  META_PARSER_ENTRY,
  getToolboxEntries,
  getWorkspaceEntries,
} from "./toolbox-presentation";

/**
 * Toolbox presentation boundary (RCCF-TOOLBOX-IA-02).
 *
 * The public toolbox composes six workspace tools plus Meta-Parser without
 * contaminating the workspace/billing registries.
 */
describe("toolbox presentation composer", () => {
  it("exposes exactly seven entries: six workspace plus one Meta-Parser", () => {
    const entries = getToolboxEntries();
    expect(entries).toHaveLength(7);
    expect(entries.filter((e) => e.kind === "workspace")).toHaveLength(6);
    expect(entries.filter((e) => e.kind === "patch-intelligence")).toHaveLength(1);
  });

  it("has no duplicate slugs, names, or routes", () => {
    const entries = getToolboxEntries();
    for (const key of ["slug", "name", "url"] as const) {
      const values = entries.map((e) => e[key]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("covers every available workspace tool with its canonical route", () => {
    const urls = getWorkspaceEntries().map((e) => e.url);
    expect(urls).toHaveLength(6);
    for (const slug of [
      "sponsorship-tracking",
      "prize-pool-splitter",
      "draft-ban",
      "tie-breaker",
      "prize-payout-tracker",
      "tournament-roster-builder",
    ]) {
      expect(urls).toContain(`/tools/${slug}`);
    }
  });

  it("presents Meta-Parser as public intelligence with a facts CTA", () => {
    expect(META_PARSER_ENTRY.kind).toBe("patch-intelligence");
    expect(META_PARSER_ENTRY.url).toBe("/meta-parser");
    expect(META_PARSER_ENTRY.ctaLabel).toBe("Browse patch facts");
    expect(META_PARSER_ENTRY.accessNote).toBe("Public facts · Free to read");
    expect(META_PARSER_ENTRY.marketingTool).toBeUndefined();
  });

  it("gives Meta-Parser no paid-plan semantics", () => {
    const raw = META_PARSER_ENTRY as unknown as Record<string, unknown>;
    for (const key of ["plan", "planSlug", "price", "amount", "internalSlug", "checkout"]) {
      expect(raw[key]).toBeUndefined();
    }
    const serialized = JSON.stringify(META_PARSER_ENTRY).toLowerCase();
    for (const phrase of ["start free", "claim", "purchase", "pricing", "workspace", "ai predict", "coaching"]) {
      expect(serialized).not.toContain(phrase);
    }
  });

  it("keeps workspace registries at six tools (isolation)", () => {
    expect(TOOLS).toHaveLength(6);
    expect(MARKETING_TOOLS).toHaveLength(6);
    expect(TOOLS.some((t) => t.slug === "meta-parser")).toBe(false);
    expect(MARKETING_TOOLS.some((t) => t.slug === "meta-parser")).toBe(false);
  });
});
