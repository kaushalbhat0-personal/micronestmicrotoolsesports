import * as React from "react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { ToolboxGroups } from "@/components/marketing/homepage/toolbox-groups";
import {
  getHomepageToolboxItems,
  resolveToolboxGroups,
} from "@/lib/marketing/homepage-seo";

const GROUPS_SOURCE = "src/components/marketing/homepage/toolbox-groups.tsx";

function sourceOf(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

/**
 * RCCF-HOMEPAGE-FINAL-POLISH-04 — the toolbox reads as one connected
 * product object with a running index, but names, order, grouping, and
 * counts stay derived from the canonical registry. These tests pin that
 * the presence upgrade added no hardcoded catalog.
 */
describe("toolbox count is registry-derived", () => {
  it("group cards and homepage items agree on the released tool total", () => {
    const groups = resolveToolboxGroups();
    const grouped = groups.reduce((sum, group) => sum + group.cards.length, 0);
    expect(grouped).toBe(getHomepageToolboxItems().length);
    expect(grouped).toBeGreaterThan(0);
  });

  it("renders the zero-padded total in the header without hardcoding it", () => {
    const total = resolveToolboxGroups().reduce((sum, group) => sum + group.cards.length, 0);
    const html = renderToString(<ToolboxGroups />);
    expect(html).toContain(`${String(total).padStart(2, "0")}`);
    expect(html).toContain("TOOLS");
    expect(sourceOf(GROUPS_SOURCE)).not.toMatch(/"[0-9]{2} TOOLS"/);
    expect(sourceOf(GROUPS_SOURCE)).toContain("padStart");
  });
});

describe("toolbox ordering and grouping are preserved", () => {
  it("keeps the four neutral groups in registry order with stable sizes", () => {
    const groups = resolveToolboxGroups();
    expect(groups.map((group) => group.label)).toEqual([
      "Run the tournament",
      "Run the business",
      "Understand the game",
      "Qualify on points",
    ]);
    expect(groups.map((group) => group.cards.length)).toEqual([4, 2, 1, 2]);
  });

  it("renders every registered tool exactly once with its canonical route", () => {
    const html = renderToString(<ToolboxGroups />);
    const urls = resolveToolboxGroups().flatMap((group) => group.cards.map((card) => card.url));
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url).toMatch(/^\//);
      expect(html).toContain(`href="${url}"`);
    }
    for (const name of resolveToolboxGroups().flatMap((group) => group.cards.map((card) => card.name))) {
      // Server HTML escapes ampersands — compare against the escaped form.
      expect(html).toContain(name.replace(/&/g, "&amp;"));
    }
  });

  it("stamps a continuous running index across shelves in registry order", () => {
    const html = renderToString(<ToolboxGroups />);
    const total = resolveToolboxGroups().reduce((sum, group) => sum + group.cards.length, 0);
    for (let position = 1; position <= total; position += 1) {
      expect(html).toContain(`>${String(position).padStart(2, "0")}<`);
    }
    // Four shelf headers (React inserts a comment between "SHELF" and the
    // number, so count the label); the tool index itself never restarts.
    expect(html.match(/SHELF/g)).toHaveLength(4);
  });
});

describe("toolbox source of truth stays single", () => {
  it("derives names and routes from the resolver instead of hardcoding them", () => {
    const code = sourceOf(GROUPS_SOURCE);
    expect(code).toContain("resolveToolboxGroups");
    expect(code).toContain("href={card.url as Route}");
    for (const name of resolveToolboxGroups().flatMap((group) => group.cards.map((card) => card.name))) {
      expect(code, `hardcoded tool name: ${name}`).not.toContain(`>${name}<`);
      expect(code, `hardcoded tool name: ${name}`).not.toContain(`"${name}"`);
    }
  });
});
