// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PatchSections, type PatchSectionView } from "./patch-sections";
import type { PublishedChange } from "@/features/meta-parser/repositories/reads";

// Enable React act() in the jsdom environment.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Grouped patch sections (RCCF-META-PARSER-UX-07). Generic section/entity
 * rendering: semantic headings, native disclosure, truthful counts, no
 * duplicated facts, no technical bucket labels.
 */

function change(id: string, partial: Partial<PublishedChange>): PublishedChange {
  return {
    entityType: "hero",
    entityName: "Abaddon",
    entityNormalized: "abaddon",
    entityKey: null,
    category: "ability",
    attribute: "damage",
    oldText: null,
    newText: null,
    oldNumeric: 80,
    newNumeric: 90,
    unit: null,
    changeType: "buff",
    confidence: "medium",
    description: `Description ${id}.`,
    id,
    ...partial,
  };
}

function sections(): PatchSectionView[] {
  return [
    {
      key: "heroes",
      label: "Heroes",
      changeCount: 7,
      groupCount: 2,
      filterHref: "/meta-parser/dota-2/7.41?entity_type=hero",
      groups: [
        {
          entityType: "hero",
          entityName: "Abaddon",
          entityNormalized: "abaddon",
          changes: [
            change("a1", { changeType: "buff" }),
            change("a2", { changeType: "buff" }),
            change("a3", { changeType: "nerf" }),
            change("a4", { changeType: "adjustment", category: "talents" }),
            change("a5", { changeType: "adjustment", category: "general" }),
            change("a6", { changeType: "adjustment", category: "ability", confidence: "low" }),
          ],
          counts: { total: 6, buff: 2, nerf: 1, adjustment: 3, rework: 0, new: 0, bugfix: 0, neutral: 0 },
        },
        {
          entityType: "hero",
          entityName: "Zeus",
          entityNormalized: "zeus",
          changes: [change("z1", { entityName: "Zeus", entityNormalized: "zeus", changeType: "nerf" })],
          counts: { total: 1, buff: 0, nerf: 1, adjustment: 0, rework: 0, new: 0, bugfix: 0, neutral: 0 },
        },
      ],
    },
    {
      key: "gameplay",
      label: "Gameplay",
      changeCount: 1,
      groupCount: 1,
      filterHref: null,
      groups: [
        {
          entityType: "system",
          entityName: "General",
          entityNormalized: "general",
          changes: [
            change("g1", {
              entityType: "system",
              entityName: "General",
              entityNormalized: "general",
              category: "system",
              attribute: null,
              oldNumeric: null,
              newNumeric: null,
              changeType: "adjustment",
              description: "Global change description.",
            }),
          ],
          counts: { total: 1, buff: 0, nerf: 0, adjustment: 1, rework: 0, new: 0, bugfix: 0, neutral: 0 },
        },
      ],
    },
  ];
}

async function renderSections(input: PatchSectionView[] = sections()) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<PatchSections sections={input} />);
  });
  return {
    container,
    cleanup: () => {
      root.unmount();
      container.remove();
    },
  };
}

describe("patch sections", () => {
  it("renders section h2 headings with entity h3 group headers", async () => {
    const { container, cleanup } = await renderSections();
    expect(container.querySelectorAll("section").length).toBe(2);
    const h2s = Array.from(container.querySelectorAll("h2")).map((h) => h.textContent);
    expect(h2s).toEqual(["Heroes", "Gameplay"]);
    const h3s = Array.from(container.querySelectorAll("h3")).map((h) => h.textContent);
    expect(h3s).toEqual(["Abaddon", "Zeus", "General"]);
    cleanup();
  });

  it("summarizes each group with truthful counts", async () => {
    const { container, cleanup } = await renderSections();
    const text = container.textContent ?? "";
    expect(text).toContain("6 changes");
    expect(text).toContain("2 Buffs · 1 Nerf · 3 Adjustments");
    expect(text).toContain("1 change");
    expect(text).toContain("2 entities · 7 changes");
    expect(text).toContain("1 entity · 1 change");
    cleanup();
  });

  it("uses native disclosure with no client state", async () => {
    const { container, cleanup } = await renderSections();
    const details = Array.from(container.querySelectorAll("details"));
    expect(details.length).toBe(3);
    for (const d of details) {
      expect(d.querySelector(":scope > summary")).not.toBeNull();
    }
    // Small result set: every group expanded for immediate inspection.
    expect(details.every((d) => d.hasAttribute("open"))).toBe(true);
    cleanup();
  });

  it("opens only the first group on large pages", async () => {
    const many: PatchSectionView[] = [
      {
        key: "heroes",
        label: "Heroes",
        changeCount: 5,
        groupCount: 5,
        filterHref: null,
        groups: Array.from({ length: 5 }, (_, i) => ({
          entityType: "hero",
          entityName: `Hero ${i}`,
          entityNormalized: `hero-${i}`,
          changes: [change(`h${i}`, { entityName: `Hero ${i}`, entityNormalized: `hero-${i}` })],
          counts: { total: 1, buff: 1, nerf: 0, adjustment: 0, rework: 0, new: 0, bugfix: 0, neutral: 0 },
        })),
      },
    ];
    const { container, cleanup } = await renderSections(many);
    const details = Array.from(container.querySelectorAll("details"));
    expect(details.filter((d) => d.hasAttribute("open")).length).toBe(1);
    expect(details[0]?.hasAttribute("open")).toBe(true);
    cleanup();
  });

  it("never shows technical bucket labels and never duplicates facts", async () => {
    const { container, cleanup } = await renderSections();
    const text = container.textContent ?? "";
    expect(text).not.toContain("System · System");
    expect(text).not.toContain("System");
    expect(text).not.toContain("All categories");
    const descriptions = ["Description a1.", "Description a6.", "Global change description."];
    for (const description of descriptions) {
      const occurrences = text.split(description).length - 1;
      expect(occurrences, description).toBe(1);
    }
    // Entity name appears once per group header, not once per change card.
    const abaddon = text.split("Abaddon").length - 1;
    expect(abaddon).toBe(1);
    cleanup();
  });

  it("links section headings to entity_type shortcuts only when provided", async () => {
    const { container, cleanup } = await renderSections();
    const heroes = Array.from(container.querySelectorAll("h2")).find(
      (h) => h.textContent === "Heroes"
    );
    expect(heroes?.querySelector("a")?.getAttribute("href")).toBe(
      "/meta-parser/dota-2/7.41?entity_type=hero"
    );
    const gameplay = Array.from(container.querySelectorAll("h2")).find(
      (h) => h.textContent === "Gameplay"
    );
    expect(gameplay?.querySelector("a")).toBeNull();
    cleanup();
  });

  it("keeps every group in a single mobile-safe column", async () => {
    const { container, cleanup } = await renderSections();
    expect(container.querySelectorAll("table").length).toBe(0);
    expect(container.innerHTML).not.toMatch(/overflow-x/);
    expect(container.innerHTML).not.toMatch(/scrollLeft|scroll-x/);
    cleanup();
  });
});
