// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { renderToString } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { QualificationCalculator } from "./qualification-calculator";

// Enable React act() in the jsdom environment.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function setInputValue(el: HTMLInputElement, value: string) {
  const view = el.ownerDocument.defaultView ?? window;
  const setter = Object.getOwnPropertyDescriptor(
    (view as unknown as { HTMLInputElement: { prototype: object } }).HTMLInputElement.prototype,
    "value"
  )?.set as ((this: HTMLInputElement, v: string) => void) | undefined;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new view.Event("input", { bubbles: true }));
}

function setSelectValue(el: HTMLSelectElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("QualificationCalculator UX", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
      root = null;
    }
    document.body.innerHTML = "";
  });

  function mount() {
    act(() => {
      root = createRoot(container);
      root.render(<QualificationCalculator />);
    });
  }

  function byLabel(text: string): HTMLElement | null {
    const labels = [...container.querySelectorAll("label")];
    const label = labels.find((l) => l.textContent?.trim() === text) ?? null;
    if (!label) return null;
    const id = label.getAttribute("for");
    return id ? container.ownerDocument.getElementById(id) : null;
  }

  it("empty state shows guidance, no verdict numbers", () => {
    mount();
    expect(container.textContent).toContain("Enter your current points");
    expect(container.textContent).not.toContain("You need");
  });

  it("entering 42 / 58 / 4 shows gap 16 and required average 4", () => {
    mount();
    act(() => {
      setInputValue(byLabel("Current points") as HTMLInputElement, "42");
      setInputValue(byLabel("Qualification target") as HTMLInputElement, "58");
      setInputValue(byLabel("Matches remaining") as HTMLInputElement, "4");
    });
    expect(container.textContent).toContain("You need 16 more points from 4 matches.");
    expect(container.textContent).toContain("Required average: 4 pts per match.");
  });

  it("what-if defaults 1st + 8 finishes project 60, above target", () => {
    mount();
    act(() => {
      setInputValue(byLabel("Current points") as HTMLInputElement, "42");
      setInputValue(byLabel("Qualification target") as HTMLInputElement, "58");
      setInputValue(byLabel("Matches remaining") as HTMLInputElement, "4");
    });
    expect(container.textContent).toContain("+18 pts");
    expect(container.textContent).toContain("60 projected");
    expect(container.textContent).toContain("Above target");
  });

  it("changing placement and finishes updates the result instantly", () => {
    mount();
    act(() => {
      setInputValue(byLabel("Current points") as HTMLInputElement, "42");
      setInputValue(byLabel("Qualification target") as HTMLInputElement, "58");
      setInputValue(byLabel("Matches remaining") as HTMLInputElement, "4");
    });
    act(() => {
      setSelectValue(byLabel("Placement") as HTMLSelectElement, "5");
    });
    // 5th (3 pts) + 8 finishes = +11 → 53 projected → below target
    expect(container.textContent).toContain("+11 pts");
    expect(container.textContent).toContain("53 projected");
    expect(container.textContent).toContain("Below target");
  });

  it("saves up to 3 scenarios and removes them", () => {
    mount();
    act(() => {
      setInputValue(byLabel("Current points") as HTMLInputElement, "42");
      setInputValue(byLabel("Qualification target") as HTMLInputElement, "58");
      setInputValue(byLabel("Matches remaining") as HTMLInputElement, "4");
    });
    const save = () =>
      ( [...container.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Save scenario")) as HTMLButtonElement ).click();
    act(() => save());
    act(() => {
      setSelectValue(byLabel("Placement") as HTMLSelectElement, "5");
    });
    act(() => save());
    expect(container.querySelectorAll('[aria-label="Saved scenarios"] li')).toHaveLength(2);
    expect(container.textContent).toContain("Scenario 1");
    expect(container.textContent).toContain("Scenario 2");
    const remove = container.querySelector('[aria-label="Remove scenario 1"]') as HTMLButtonElement;
    act(() => remove.click());
    expect(container.querySelectorAll('[aria-label="Saved scenarios"] li')).toHaveLength(1);
  });

  it("average-rate mode projects the finish", () => {
    mount();
    act(() => {
      setInputValue(byLabel("Current points") as HTMLInputElement, "42");
      setInputValue(byLabel("Qualification target") as HTMLInputElement, "58");
      setInputValue(byLabel("Matches remaining") as HTMLInputElement, "4");
      setInputValue(byLabel("Average points per match") as HTMLInputElement, "6");
    });
    // 42 + 6×4 = 66 → above target
    expect(container.textContent).toContain("66 projected");
  });

  it("share affordances appear after mount (client-only, hydration-safe)", () => {
    const html = renderToString(<QualificationCalculator />);
    expect(html).not.toContain("Copy share link");
    mount();
    expect(container.innerHTML).toContain("Copy share link");
    expect(container.innerHTML).toContain("Share on WhatsApp");
  });

  it("rejects negative input with an inline error", () => {
    mount();
    act(() => {
      setInputValue(byLabel("Current points") as HTMLInputElement, "-5");
    });
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("whole number");
    expect(container.textContent).not.toContain("You need");
  });

  it("exposes labels, live regions, and keyboard-focusable controls", () => {
    mount();
    for (const name of ["Current points", "Qualification target", "Matches remaining", "Scoring", "Placement", "Finishes", "Average points per match"]) {
      expect(byLabel(name), `label: ${name}`).not.toBeNull();
    }
    expect(container.querySelectorAll('[aria-live="polite"]').length).toBeGreaterThan(0);
  });
});
