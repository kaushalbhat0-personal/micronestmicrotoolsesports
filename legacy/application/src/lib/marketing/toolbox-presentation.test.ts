import { describe, expect, it } from "vitest";
import { TOOLS } from "@/config/app/tools";
import { MARKETING_TOOLS } from "@/config/marketing/tools";
import {
  BGMI_QUALIFICATION_ENTRY,
  BGMI_TOURNAMENTS_ENTRY,
  META_PARSER_ENTRY,
  getToolboxEntries,
  getWorkspaceEntries,
} from "./toolbox-presentation";

/**
 * Toolbox presentation boundary (RCCF-TOOLBOX-IA-02 + RCCF-BGMI-TOURNAMENTS-02).
 *
 * The public toolbox composes six workspace tools plus Meta-Parser plus the
 * BGMI Qualification Simulator plus the BGMI Tournament Hub without
 * contaminating the workspace/billing registries.
 */
describe("toolbox presentation composer", () => {
  it("exposes workspace plus Meta-Parser plus BGMI plus Hub entries (counts derived)", () => {
    const entries = getToolboxEntries();
    expect(entries).toHaveLength(getWorkspaceEntries().length + 3);
    expect(entries.filter((e) => e.kind === "workspace")).toHaveLength(getWorkspaceEntries().length);
    expect(entries.filter((e) => e.kind === "patch-intelligence")).toHaveLength(1);
    expect(entries.filter((e) => e.kind === "public-microtool")).toHaveLength(1);
    expect(entries.filter((e) => e.kind === "tournament-hub")).toHaveLength(1);
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

  it("presents the BGMI Qualification Simulator as a free public microtool", () => {
    expect(BGMI_QUALIFICATION_ENTRY.kind).toBe("public-microtool");
    expect(BGMI_QUALIFICATION_ENTRY.slug).toBe("bgmi-qualification");
    expect(BGMI_QUALIFICATION_ENTRY.name).toBe("BGMI Qualification Simulator");
    expect(BGMI_QUALIFICATION_ENTRY.url).toBe("/bgmi-qualification");
    expect(BGMI_QUALIFICATION_ENTRY.description).toBe("Know what your team needs to qualify.");
    expect(BGMI_QUALIFICATION_ENTRY.ctaLabel).toBe("Try it now");
    expect(BGMI_QUALIFICATION_ENTRY.accessNote).toBe("Free microtool · No signup");
    expect(BGMI_QUALIFICATION_ENTRY.marketingTool).toBeUndefined();
  });

  it("gives the BGMI simulator no paid-plan semantics", () => {
    const raw = BGMI_QUALIFICATION_ENTRY as unknown as Record<string, unknown>;
    for (const key of ["plan", "planSlug", "price", "amount", "internalSlug", "checkout"]) {
      expect(raw[key]).toBeUndefined();
    }
    const serialized = JSON.stringify(BGMI_QUALIFICATION_ENTRY).toLowerCase();
    for (const phrase of ["start free", "claim", "purchase", "pricing", "workspace", "guaranteed", "safe"]) {
      expect(serialized).not.toContain(phrase);
    }
  });

  it("presents the BGMI Tournament Hub as public standings with no paid-plan semantics", () => {
    expect(BGMI_TOURNAMENTS_ENTRY.kind).toBe("tournament-hub");
    expect(BGMI_TOURNAMENTS_ENTRY.slug).toBe("bgmi-tournaments");
    expect(BGMI_TOURNAMENTS_ENTRY.name).toBe("BGMI Tournament Hub");
    expect(BGMI_TOURNAMENTS_ENTRY.url).toBe("/bgmi-tournaments");
    expect(BGMI_TOURNAMENTS_ENTRY.description).toBe("See standings, match results, and history.");
    expect(BGMI_TOURNAMENTS_ENTRY.ctaLabel).toBe("Browse standings");
    expect(BGMI_TOURNAMENTS_ENTRY.accessNote).toBe("Public standings · Free to read");
    expect(BGMI_TOURNAMENTS_ENTRY.marketingTool).toBeUndefined();
    const raw = BGMI_TOURNAMENTS_ENTRY as unknown as Record<string, unknown>;
    for (const key of ["plan", "planSlug", "price", "amount", "internalSlug", "checkout"]) {
      expect(raw[key]).toBeUndefined();
    }
    const serialized = JSON.stringify(BGMI_TOURNAMENTS_ENTRY).toLowerCase();
    for (const phrase of ["start free", "claim", "purchase", "pricing", "workspace", "guaranteed", "live", "real-time"]) {
      expect(serialized).not.toContain(phrase);
    }
  });

  it("keeps workspace registries at six tools (isolation)", () => {
    expect(TOOLS).toHaveLength(6);
    expect(MARKETING_TOOLS).toHaveLength(6);
    expect(TOOLS.some((t) => t.slug === "meta-parser")).toBe(false);
    expect(MARKETING_TOOLS.some((t) => t.slug === "meta-parser")).toBe(false);
    expect(TOOLS.some((t) => t.slug === "bgmi-qualification")).toBe(false);
    expect(MARKETING_TOOLS.some((t) => t.slug === "bgmi-qualification")).toBe(false);
    expect(TOOLS.some((t) => t.slug === "bgmi-tournaments")).toBe(false);
    expect(MARKETING_TOOLS.some((t) => t.slug === "bgmi-tournaments")).toBe(false);
  });
});
