// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { describe, expect, it, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { CircleIqMicroChallenge } from "@/components/marketing/homepage/circle-iq-micro-challenge";

declare global {
  // Required `var` for a global augmentation; silences react-dom's
  // act-environment warning under vitest + jsdom.
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  const active = root;
  if (active) act(() => active.unmount());
  root = null;
  host?.remove();
  host = null;
});

function renderChallenge(): HTMLElement {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root!.render(<CircleIqMicroChallenge />);
  });
  return host;
}

function pick(hostEl: HTMLElement, id: "A" | "B" | "C"): HTMLButtonElement {
  const button = hostEl.querySelector<HTMLButtonElement>(`button[aria-label^="Rotation option ${id}:"]`);
  expect(button, `option ${id} button`).not.toBeNull();
  act(() => {
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  return button!;
}

describe("micro-challenge DOM interaction", () => {
  it("clicking B reveals the good read with the drill CTA", () => {
    const hostEl = renderChallenge();
    const buttonB = pick(hostEl, "B");
    expect(hostEl.textContent).toContain("Good read");
    expect(hostEl.textContent).toContain("You chose the safer rotation.");
    const cta = hostEl.querySelector('a[href="/bgmi-lab/circle-iq"]');
    expect(cta?.textContent).toContain("Try Circle IQ");
    expect(hostEl.querySelector('[role="status"]')).not.toBeNull();
    // The picked map position carries a non-color indicator; the rest do not.
    expect(buttonB.querySelector("[data-selected-marker]")).not.toBeNull();
    for (const id of ["A", "C"] as const) {
      const idle = hostEl.querySelector(`button[aria-label^="Rotation option ${id}:"]`);
      expect(idle?.querySelector("[data-selected-marker]")).toBeNull();
    }
  });

  it("clicking A or C reveals the different read", () => {
    for (const id of ["A", "C"] as const) {
      const hostEl = renderChallenge();
      pick(hostEl, id);
      expect(hostEl.textContent).toContain("Different read");
      expect(hostEl.textContent).toContain("The stronger route was toward the center.");
      expect(hostEl.textContent).not.toContain("Good read");
      if (root) act(() => root!.unmount());
      root = null;
      host?.remove();
      host = null;
    }
  });

  it("try again resets to the initial prompt", () => {
    const hostEl = renderChallenge();
    pick(hostEl, "B");
    expect(hostEl.textContent).toContain("Good read");
    const resetButton = [...hostEl.querySelectorAll("button")].find((b) => b.textContent?.includes("Try again"));
    expect(resetButton, "reset button").not.toBeUndefined();
    act(() => {
      resetButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(hostEl.textContent).toContain("Pick a position on the map");
    expect(hostEl.textContent).not.toContain("Good read");
    expect(hostEl.querySelector('[role="status"]')).toBeNull();
  });

  it("exposes selection semantically and stays keyboard-operable", () => {
    const hostEl = renderChallenge();
    const buttonB = pick(hostEl, "B");
    expect(buttonB.getAttribute("aria-pressed")).toBe("true");
    // Option buttons are native buttons: focusable by keyboard with a visible ring.
    buttonB.focus();
    expect(document.activeElement).toBe(buttonB);
    expect(buttonB.className).toContain("focus-visible:ring-2");
    // Keyboard activation path (focus + click) reveals the result.
    const hostEl2 = renderChallenge();
    const buttonA = hostEl2.querySelector<HTMLButtonElement>('button[aria-label^="Rotation option A:"]');
    expect(buttonA, "option A button").not.toBeNull();
    buttonA!.focus();
    expect(document.activeElement).toBe(buttonA);
    act(() => {
      buttonA!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(hostEl2.textContent).toContain("Different read");
  });
});
