// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { FactsFilters } from "./facts-filters";

// Enable React act() in the jsdom environment.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Patch-page filters (RCCF-META-PARSER-UX-03). Plain-language labels over
 * unchanged URL keys, game-specific category options, keyboard-operable
 * native controls, no client JS architecture.
 */

async function renderFilters(overrides: Partial<React.ComponentProps<typeof FactsFilters>> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const props: React.ComponentProps<typeof FactsFilters> = {
    basePath: "/meta-parser/dota-2/7.41",
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
  it("uses plain-language labels associated with their controls", async () => {
    const { container, cleanup } = await renderFilters();
    for (const [text, id] of [
      ["Category", "facts-category"],
      ["Change", "facts-change"],
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
    expect(container.textContent).not.toContain("Change type");
    cleanup();
  });

  it("keeps URL query keys unchanged (entity_type, change_type, entity)", async () => {
    const { container, cleanup } = await renderFilters();
    expect(container.querySelector("#facts-category")?.getAttribute("name")).toBe("entity_type");
    expect(container.querySelector("#facts-change")?.getAttribute("name")).toBe("change_type");
    expect(container.querySelector("#facts-search")?.getAttribute("name")).toBe("entity");
    cleanup();
  });

  it("offers only the patch's own categories — no universal hardcoded list", async () => {
    const { container, cleanup } = await renderFilters();
    const options = Array.from(container.querySelectorAll("#facts-category option")).map(
      (o) => o.textContent
    );
    expect(options).toEqual(["All categories", "Hero", "Item", "System"]);
    expect(options).not.toContain("Champion");
    expect(options).not.toContain("Agent");
    cleanup();
  });

  it("keeps the normal Category select for single-category patches (F4)", async () => {
    const { container, cleanup } = await renderFilters({ entityTypes: ["hero"] });
    const select = container.querySelector("#facts-category");
    expect(select?.tagName).toBe("SELECT");
    expect(select?.getAttribute("name")).toBe("entity_type");
    const options = Array.from(container.querySelectorAll("#facts-category option")).map(
      (o) => o.textContent
    );
    expect(options).toEqual(["All categories", "Hero"]);
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
