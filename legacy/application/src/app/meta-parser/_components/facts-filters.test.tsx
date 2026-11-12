// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { FactsFilters } from "./facts-filters";

// Enable React act() in the jsdom environment.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Patch-page filters (RCCF-META-PARSER-UX-07). Human labels ("What changed?",
 * "Change type") over unchanged URL keys, taxonomy-driven section options,
 * keyboard-operable native controls, no client JS architecture.
 */

async function renderFilters(overrides: Partial<React.ComponentProps<typeof FactsFilters>> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const props: React.ComponentProps<typeof FactsFilters> = {
    basePath: "/meta-parser/dota-2/7.41",
    gameSlug: "dota-2",
    entityType: null,
    changeType: null,
    entity: null,
    entityTypes: ["hero", "item", "system"],
    entityNames: ["Alchemist", "Blink Dagger"],
    searchPlaceholder: "Search heroes…",
    hasFilters: false,
    ...overrides,
  };
  await act(async () => {
    root.render(<FactsFilters {...props} />);
  });
  return {
    container,
    cleanup: () => {
      root.unmount();
      container.remove();
    },
  };
}

describe("facts filters labels and controls", () => {
  it("uses human labels associated with their controls", async () => {
    const { container, cleanup } = await renderFilters();
    for (const [text, id] of [
      ["What changed?", "facts-category"],
      ["Change type", "facts-change"],
      ["Search", "facts-search"],
    ] as const) {
      expect(container.textContent).toContain(text);
      const labelled = container.querySelector(`#${id}`) as HTMLElement | null;
      expect(labelled).not.toBeNull();
      const forLabel = Array.from(container.querySelectorAll("label")).find(
        (el) => el.textContent === text
      );
      expect(forLabel?.getAttribute("for")).toBe(id);
    }
    expect(container.textContent).not.toContain("Entity type");
    cleanup();
  });

  it("keeps URL query keys unchanged (entity_type, change_type, entity)", async () => {
    const { container, cleanup } = await renderFilters();
    expect(container.querySelector("#facts-category")?.getAttribute("name")).toBe("entity_type");
    expect(container.querySelector("#facts-change")?.getAttribute("name")).toBe("change_type");
    expect(container.querySelector("#facts-search")?.getAttribute("name")).toBe("entity");
    cleanup();
  });

  it("offers taxonomy sections for the patch's own entity types — never raw buckets", async () => {
    const { container, cleanup } = await renderFilters();
    const options = Array.from(container.querySelectorAll("#facts-category option")).map(
      (o) => o.textContent
    );
    expect(options).toEqual(["All", "Heroes", "Items", "Gameplay"]);
    expect(options).not.toContain("System");
    expect(options).not.toContain("Champion");
    expect(options).not.toContain("Agent");
    const values = Array.from(container.querySelectorAll("#facts-category option")).map(
      (o) => o.getAttribute("value")
    );
    // URL values stay internal vocabulary.
    expect(values).toEqual(["", "hero", "item", "system"]);
    cleanup();
  });

  it("maps valorant and lol patches to their own sections", async () => {
    const valorant = await renderFilters({
      basePath: "/meta-parser/valorant/10.08",
      gameSlug: "valorant",
      entityTypes: ["agent", "weapon", "map", "system"],
    });
    expect(
      Array.from(valorant.container.querySelectorAll("#facts-category option")).map(
        (o) => o.textContent
      )
    ).toEqual(["All", "Agents", "Weapons", "Maps", "Gameplay"]);
    valorant.cleanup();
    const lol = await renderFilters({
      basePath: "/meta-parser/lol/14.10",
      gameSlug: "lol",
      entityTypes: ["champion", "item", "system"],
    });
    expect(
      Array.from(lol.container.querySelectorAll("#facts-category option")).map((o) => o.textContent)
    ).toEqual(["All", "Champions", "Items", "Gameplay"]);
    lol.cleanup();
  });

  it("labels change types in human plurals over unchanged stored values", async () => {
    const { container, cleanup } = await renderFilters();
    const options = Array.from(container.querySelectorAll("#facts-change option")).map(
      (o) => o.textContent
    );
    expect(options).toEqual([
      "All changes",
      "Buffs",
      "Nerfs",
      "Adjustments",
      "Reworks",
      "New",
      "Bug fixes",
      "Neutral",
    ]);
    const values = Array.from(container.querySelectorAll("#facts-change option")).map((o) =>
      o.getAttribute("value")
    );
    expect(values).toEqual(["", "buff", "nerf", "adjustment", "rework", "new", "bugfix", "neutral"]);
    cleanup();
  });

  it("keeps the normal section select for single-category patches (F4)", async () => {
    const { container, cleanup } = await renderFilters({ entityTypes: ["hero"] });
    const select = container.querySelector("#facts-category");
    expect(select?.tagName).toBe("SELECT");
    expect(select?.getAttribute("name")).toBe("entity_type");
    const options = Array.from(container.querySelectorAll("#facts-category option")).map(
      (o) => o.textContent
    );
    expect(options).toEqual(["All", "Heroes"]);
    cleanup();
  });

  it("suggests patch entity names through a datalist on the search box", async () => {
    const { container, cleanup } = await renderFilters();
    const input = container.querySelector("#facts-search") as HTMLInputElement | null;
    expect(input?.getAttribute("placeholder")).toBe("Search heroes…");
    expect(input?.getAttribute("list")).toBe("facts-search-suggestions");
    const suggestions = Array.from(
      container.querySelectorAll("#facts-search-suggestions option")
    ).map((o) => o.getAttribute("value"));
    expect(suggestions).toEqual(["Alchemist", "Blink Dagger"]);
    cleanup();
  });

  it("shows Clear only when filters are active, linking to the bare patch path", async () => {
    const plain = await renderFilters({ hasFilters: false });
    expect(plain.container.textContent).not.toContain("Clear");
    plain.cleanup();
    const filtered = await renderFilters({ hasFilters: true, entity: "alchemist" });
    const clear = Array.from(filtered.container.querySelectorAll("a")).find(
      (a) => a.textContent === "Clear"
    );
    expect(clear?.getAttribute("href")).toBe("/meta-parser/dota-2/7.41");
    filtered.cleanup();
  });

  it("keeps every control keyboard-focusable with a 44px minimum target", async () => {
    const { container, cleanup } = await renderFilters({ hasFilters: true });
    const controls = Array.from(
      container.querySelectorAll("select, input, button, a")
    ) as HTMLElement[];
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control.tabIndex, control.tagName).not.toBe(-1);
      control.focus();
      expect(document.activeElement).toBe(control);
      // 44px minimum target is enforced via utility class (no CSS in jsdom).
      expect(control.className).toMatch(/min-h-\[44px\]/);
    }
    cleanup();
  });
});
