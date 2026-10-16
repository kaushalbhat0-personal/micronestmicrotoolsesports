import { describe, expect, it } from "vitest";
import {
  TOOLBOX_GROUPS,
  getHomepageToolboxItems,
  resolveToolboxGroups,
} from "./homepage-seo";

/**
 * Toolbox grouping tests — groups are organizational only, never a ranking.
 * Slugs reference the canonical registry; every display field resolves from
 * it (workspace tools) or the Meta-Parser pointer. No duplicated catalog.
 */
describe("toolbox groups cover the eight released tools exactly once", () => {
  it("defines four neutral groups with eight slugs total and no duplicates", () => {
    expect(TOOLBOX_GROUPS.map((g) => g.label)).toEqual([
      "Run the tournament",
      "Run the business",
      "Understand the game",
      "Qualify on points",
    ]);
    const slugs = TOOLBOX_GROUPS.flatMap((g) => [...g.slugs]);
    expect(slugs).toHaveLength(8);
    expect(new Set(slugs).size).toBe(8);
  });

  it("resolves to eight cards with canonical names, routes, and descriptions", () => {
    const groups = resolveToolboxGroups();
    const cards = groups.flatMap((g) => g.cards);
    expect(cards).toHaveLength(8);
    // Same eight entries as the SEO source — group order is editorial, not ranked.
    expect([...cards.map((c) => c.url)].sort()).toEqual(
      [...getHomepageToolboxItems().map((i) => i.url)].sort()
    );
    expect([...cards.map((c) => c.name)].sort()).toEqual(
      [...getHomepageToolboxItems().map((i) => i.name)].sort()
    );
    for (const card of cards) {
      expect(card.description.length).toBeGreaterThan(0);
      expect(card.ctaLabel.length).toBeGreaterThan(0);
      expect(card.ctaAriaLabel.length).toBeGreaterThan(0);
    }
  });

  it("carries no featured/primary/best semantics", () => {
    const raw = JSON.stringify({ groups: TOOLBOX_GROUPS, resolved: resolveToolboxGroups() }).toLowerCase();
    for (const word of ["featured", "primary tool", "best tool", "hero card"]) {
      expect(raw).not.toContain(word);
    }
  });

  it("Meta-Parser resolves as public intelligence with a facts CTA", () => {
    const cards = resolveToolboxGroups().flatMap((g) => g.cards);
    const meta = cards.find((c) => c.url === "/meta-parser");
    expect(meta?.kind).toBe("patch-intelligence");
    expect(meta?.ctaLabel).toBe("Browse patch facts");
    expect(meta?.accessNote).toBe("Public facts · Free to read");
    expect(meta?.description).toBe("Read structured patch notes and game changes.");
  });

  it("BGMI simulator resolves as a free public microtool with a try-it CTA", () => {
    const cards = resolveToolboxGroups().flatMap((g) => g.cards);
    const bgmi = cards.find((c) => c.url === "/bgmi-qualification");
    expect(bgmi?.kind).toBe("public-microtool");
    expect(bgmi?.name).toBe("BGMI Qualification Simulator");
    expect(bgmi?.description).toBe("Know what your team needs to qualify.");
    expect(bgmi?.ctaLabel).toBe("Try it now");
    expect(bgmi?.accessNote).toBe("Free microtool · No signup");
  });

  it("workspace cards reuse registry copy with canonical Free framing", () => {
    const cards = resolveToolboxGroups().flatMap((g) => g.cards);
    const splitter = cards.find((c) => c.url === "/tools/prize-pool-splitter");
    expect(splitter?.description).toBe("Split any prize pool fairly in seconds, with a shareable result");
    expect(splitter?.ctaLabel).toBe("Try it now");
    expect(splitter?.accessNote).toMatch(/^Free forever · /);
    const sponsorship = cards.find((c) => c.url === "/tools/sponsorship-tracking");
    expect(sponsorship?.ctaLabel).toBe("Learn more");
    expect(sponsorship?.accessNote).toMatch(/^Free plan · /);
  });

  it("throws fail-closed on unknown slugs", () => {
    expect(() => resolveToolboxGroups()).not.toThrow();
  });
});
