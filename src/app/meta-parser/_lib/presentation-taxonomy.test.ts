import { describe, expect, it } from "vitest";
import {
  OTHER_SECTION,
  getPresentationSection,
  getPresentationTaxonomy,
  sectionOrder,
  sectionsForEntityTypes,
} from "./presentation-taxonomy";

/**
 * Presentation taxonomy tests (RCCF-META-PARSER-UX-07). Pure mapping:
 * internal parser buckets → human patch sections. No database, no React.
 */
describe("dota-2 presentation taxonomy", () => {
  it("maps hero → Heroes, item → Items, system → Gameplay", () => {
    expect(getPresentationSection("dota-2", "hero").label).toBe("Heroes");
    expect(getPresentationSection("dota-2", "item").label).toBe("Items");
    expect(getPresentationSection("dota-2", "system").label).toBe("Gameplay");
  });

  it("maps unknown entity types to Other without crashing", () => {
    expect(getPresentationSection("dota-2", "neutral-creep")).toEqual(OTHER_SECTION);
    expect(getPresentationSection("dota-2", "")).toEqual(OTHER_SECTION);
  });

  it("orders sections Heroes → Items → Gameplay → Other (declared, pinned)", () => {
    expect(getPresentationTaxonomy("dota-2").sections.map((s) => s.label)).toEqual([
      "Heroes",
      "Items",
      "Gameplay",
      "Other",
    ]);
  });

  it("does not invent Neutral Items, Map, or Neutral Creep sections", () => {
    const labels = getPresentationTaxonomy("dota-2").sections.map((s) => s.label);
    expect(labels).not.toContain("Neutral Items");
    expect(labels).not.toContain("Neutral Creeps");
    expect(labels).not.toContain("Map");
    expect(labels).not.toContain("Global Changes");
  });
});

describe("valorant presentation taxonomy", () => {
  it("maps agent → Agents, weapon → Weapons, map → Maps, system → Gameplay", () => {
    expect(getPresentationSection("valorant", "agent").label).toBe("Agents");
    expect(getPresentationSection("valorant", "weapon").label).toBe("Weapons");
    expect(getPresentationSection("valorant", "map").label).toBe("Maps");
    expect(getPresentationSection("valorant", "system").label).toBe("Gameplay");
  });

  it("maps unknown entity types to Other without crashing", () => {
    expect(getPresentationSection("valorant", "mode")).toEqual(OTHER_SECTION);
  });

  it("orders sections Agents → Weapons → Maps → Gameplay → Other (declared, pinned)", () => {
    expect(getPresentationTaxonomy("valorant").sections.map((s) => s.label)).toEqual([
      "Agents",
      "Weapons",
      "Maps",
      "Gameplay",
      "Other",
    ]);
  });
});

describe("lol presentation taxonomy", () => {
  it("maps champion → Champions, item → Items, system → Gameplay", () => {
    expect(getPresentationSection("lol", "champion").label).toBe("Champions");
    expect(getPresentationSection("lol", "item").label).toBe("Items");
    expect(getPresentationSection("lol", "system").label).toBe("Gameplay");
  });

  it("maps unknown entity types to Other without crashing", () => {
    expect(getPresentationSection("lol", "rune")).toEqual(OTHER_SECTION);
  });

  it("orders sections Champions → Items → Gameplay → Other (declared, pinned)", () => {
    expect(getPresentationTaxonomy("lol").sections.map((s) => s.label)).toEqual([
      "Champions",
      "Items",
      "Gameplay",
      "Other",
    ]);
  });
});

describe("taxonomy fallbacks and filter options", () => {
  it("maps unknown games to Other without crashing", () => {
    expect(getPresentationTaxonomy("unknown-game").sections).toEqual([OTHER_SECTION]);
    expect(getPresentationSection("unknown-game", "hero")).toEqual(OTHER_SECTION);
    expect(getPresentationSection("", "hero")).toEqual(OTHER_SECTION);
  });

  it("builds section-ordered filter options from a patch's own entity types", () => {
    expect(sectionsForEntityTypes("dota-2", ["system", "hero", "item"])).toEqual([
      { value: "hero", label: "Heroes", sectionKey: "heroes" },
      { value: "item", label: "Items", sectionKey: "items" },
      { value: "system", label: "Gameplay", sectionKey: "gameplay" },
    ]);
  });

  it("collapses unknown patch types into a single Other option", () => {
    expect(sectionsForEntityTypes("dota-2", ["hero", "boss", "neutral-creep"])).toEqual([
      { value: "hero", label: "Heroes", sectionKey: "heroes" },
      { value: "boss", label: "Other", sectionKey: "other" },
    ]);
  });

  it("returns no options for patches without entity types", () => {
    expect(sectionsForEntityTypes("dota-2", [])).toEqual([]);
  });

  it("is deterministic across repeated calls", () => {
    const first = sectionsForEntityTypes("valorant", ["system", "map", "agent", "weapon"]);
    const second = sectionsForEntityTypes("valorant", ["system", "map", "agent", "weapon"]);
    expect(second).toEqual(first);
    expect(first.map((o) => o.label)).toEqual(["Agents", "Weapons", "Maps", "Gameplay"]);
  });

  it("exposes a stable section order independent of database result order", () => {
    expect(sectionOrder("dota-2", "hero")).toBeLessThan(sectionOrder("dota-2", "item"));
    expect(sectionOrder("dota-2", "item")).toBeLessThan(sectionOrder("dota-2", "system"));
    expect(sectionOrder("dota-2", "system")).toBeLessThan(
      sectionOrder("dota-2", "neutral-creep")
    );
  });
});
