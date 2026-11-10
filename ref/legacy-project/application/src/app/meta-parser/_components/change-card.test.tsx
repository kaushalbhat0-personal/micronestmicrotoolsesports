// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ChangeCard } from "./change-card";
import type { PublishedChange } from "@/features/meta-parser/repositories/reads";

// Enable React act() in the jsdom environment.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Change-card hierarchy (RCCF-META-PARSER-UX-03). Reading order: entity +
 * direction, what changed, context, exact fact. Facts render verbatim.
 */

const CHANGE: PublishedChange = {
  id: "change-1",
  entityType: "hero",
  entityName: "Clockwerk",
  entityNormalized: "clockwerk",
  entityKey: "clockwerk",
  category: "ability",
  attribute: "damage",
  oldText: null,
  newText: null,
  oldNumeric: 80,
  newNumeric: 90,
  unit: null,
  changeType: "buff",
  confidence: "high",
  description: "Rocket Flare damage increased.",
};

async function renderCard(change: PublishedChange = CHANGE) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<ChangeCard change={change} />);
  });
  return {
    container,
    cleanup: () => {
      root.unmount();
      container.remove();
    },
  };
}

describe("change card hierarchy", () => {
  it("leads with the entity and direction signal", async () => {
    const { container, cleanup } = await renderCard();
    expect(container.querySelector("h3")?.textContent).toBe("Clockwerk");
    expect(container.textContent).toContain("Buff");
    cleanup();
  });

  it("surfaces what changed before the exact fact, with wrappable secondary context", async () => {
    const { container, cleanup } = await renderCard();
    const text = container.textContent ?? "";
    const whatIndex = text.indexOf("Damage");
    const factIndex = text.indexOf("90");
    expect(whatIndex).toBeGreaterThanOrEqual(0);
    expect(factIndex).toBeGreaterThan(whatIndex);
    expect(text).toContain("Ability · Hero");
    const metaRow = container.querySelector(".flex-wrap");
    expect(metaRow?.className).toMatch(/break-words|flex-wrap/);
    cleanup();
  });

  it("humanizes machine-style attributes without altering stored values (F1)", async () => {
    const { container, cleanup } = await renderCard({
      ...CHANGE,
      attribute: "unseeing_shield_base_barrier_magic_block",
    });
    expect(container.textContent).toContain("Unseeing Shield Base Barrier Magic Block");
    expect(container.textContent).not.toContain("unseeing_shield_base_barrier_magic_block");
    cleanup();
  });

  it("renders exact values verbatim with an accessible transition label", async () => {
    const { container, cleanup } = await renderCard();
    expect(container.textContent).toContain("80");
    expect(container.textContent).toContain("90");
    expect(container.textContent).toContain("Rocket Flare damage increased.");
    expect(
      container.querySelector('[aria-label="Changed from 80 to 90"]')
    ).not.toBeNull();
    cleanup();
  });

  it("labels textual transitions accessibly with exact displayed values (F2)", async () => {
    const { container, cleanup } = await renderCard({
      ...CHANGE,
      oldText: "Day",
      newText: "Night",
      oldNumeric: null,
      newNumeric: null,
    });
    expect(container.textContent).toContain("Day");
    expect(container.textContent).toContain("Night");
    expect(
      container.querySelector('[aria-label="Changed from Day to Night"]')
    ).not.toBeNull();
    cleanup();
  });

  it("labels textual transitions with spaces, punctuation, and numbers (F2)", async () => {
    const { container, cleanup } = await renderCard({
      ...CHANGE,
      oldText: "Active ( Rank 1 )",
      newText: "Inactive — Rank 2/3",
      oldNumeric: null,
      newNumeric: null,
    });
    expect(
      container.querySelector('[aria-label="Changed from Active ( Rank 1 ) to Inactive — Rank 2/3"]')
    ).not.toBeNull();
    cleanup();
  });

  it("never exposes internal identifiers", async () => {
    const { container, cleanup } = await renderCard();
    const text = (container.textContent ?? "").toLowerCase();
    for (const token of ["stable_key", "stablekey", "content_hash", "confidence", "parser", "entity_key"]) {
      expect(text).not.toContain(token);
    }
    cleanup();
  });
});

describe("change card section context (RCCF-META-PARSER-UX-07)", () => {
  it("never renders System · System inside a Gameplay section", async () => {
    const { container, cleanup } = await renderCard({
      ...CHANGE,
      entityType: "system",
      entityName: "General",
      category: "system",
      attribute: null,
    });
    const withoutSection = container.textContent ?? "";
    expect(withoutSection).toContain("System · System");
    cleanup();

    const sectioned = document.createElement("div");
    document.body.appendChild(sectioned);
    const root = createRoot(sectioned);
    await act(async () => {
      root.render(
        <ChangeCard
          change={{
            ...CHANGE,
            entityType: "system",
            entityName: "General",
            category: "system",
            attribute: null,
          }}
          sectionLabel="Gameplay"
          hideEntityName
        />
      );
    });
    const text = sectioned.textContent ?? "";
    expect(text).not.toContain("System · System");
    expect(text).not.toContain("System");
    expect(text).toContain("Gameplay");
    expect(sectioned.querySelector("h3")).toBeNull();
    root.unmount();
    sectioned.remove();
  });

  it("keeps meaningful categories inside their section", async () => {
    const sectioned = document.createElement("div");
    document.body.appendChild(sectioned);
    const root = createRoot(sectioned);
    await act(async () => {
      root.render(<ChangeCard change={CHANGE} sectionLabel="Heroes" hideEntityName />);
    });
    const text = sectioned.textContent ?? "";
    expect(text).toContain("Ability");
    expect(text).not.toContain("Hero");
    expect(text).toContain("Rocket Flare damage increased.");
    root.unmount();
    sectioned.remove();
  });
});
