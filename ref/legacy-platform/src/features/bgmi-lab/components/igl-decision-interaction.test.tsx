// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, afterEach } from "vitest";
import { IglDecisionShell } from "./igl-decision-shell";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let cleanup: (() => void) | null = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
  document.body.innerHTML = "";
});

function renderShell(): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  act(() => {
    root.render(<IglDecisionShell />);
  });
  cleanup = () => act(() => root.unmount());
  return host;
}

function callButtons(host: HTMLElement): HTMLButtonElement[] {
  return [...host.querySelectorAll<HTMLButtonElement>('div[role="group"][aria-label="Your call"] button')];
}

function findButton(host: HTMLElement, text: string): HTMLButtonElement | undefined {
  return [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.includes(text));
}

function click(el: HTMLElement) {
  act(() => {
    el.click();
  });
}

function intelButtons(host: HTMLElement): HTMLButtonElement[] {
  return [...host.querySelectorAll<HTMLButtonElement>('section[aria-label="Intel"] button')];
}

/** Authored strong slot per round (matches the bank order). */
const STRONG_SLOT = [1, 1, 0, 2, 1, 1];

function playScenario(host: HTMLElement, round: number, wantStrong: boolean): void {
  const buttons = callButtons(host);
  expect(buttons.length).toBeGreaterThanOrEqual(2);
  const slot = wantStrong ? STRONG_SLOT[round]! : (STRONG_SLOT[round]! + 1) % buttons.length;
  const target = buttons[slot]!;
  click(target);
  const commit = findButton(host, "Commit to this call");
  expect(commit).not.toBeUndefined();
  expect(commit!.disabled).toBe(false);
  click(commit!);
  expect(host.textContent).toContain("What followed");
}

function advance(host: HTMLElement): boolean {
  const next = findButton(host, "Next call");
  if (next) {
    click(next);
    return true;
  }
  const seeResult = findButton(host, "See result");
  if (seeResult) {
    click(seeResult);
    return false;
  }
  throw new Error("expected Next call or See result");
}

describe("igl-decision interaction — full drill loop", () => {
  it("inspects intel, commits a locked call, and cannot change it", () => {
    const host = renderShell();
    const intel = intelButtons(host);
    expect(intel.length).toBe(2);
    click(intel[0]!);
    expect(intel[0]!.getAttribute("aria-pressed")).toBe("true");
    expect(host.textContent).toContain("Both squads are still strong enough");

    const buttons = callButtons(host);
    click(buttons[0]!);
    expect(buttons[0]!.getAttribute("aria-pressed")).toBe("true");
    click(findButton(host, "Commit to this call")!);
    expect(host.textContent).toContain("What followed");
    // Locked: selecting another call no longer changes state.
    const pressedBefore = callButtons(host).map((b) => b.getAttribute("aria-pressed"));
    click(callButtons(host)[1]!);
    expect(callButtons(host).map((b) => b.getAttribute("aria-pressed"))).toEqual(pressedBefore);
    // Locked: intel cannot be revealed after commit.
    expect(intelButtons(host).every((b) => b.disabled)).toBe(true);
  });

  it("completes all six scenarios and shares the honest result", () => {
    const host = renderShell();
    let continued = true;
    let rounds = 0;
    while (continued && rounds < 6) {
      // Strong on the first three, riskier on the last three: 3/6.
      playScenario(host, rounds, rounds < 3);
      continued = advance(host);
      rounds += 1;
    }
    expect(rounds).toBe(6);
    expect(host.textContent).toContain("FINAL CALL");
    expect(host.textContent).toContain("3 / 6");
    expect(host.textContent).toContain("Developing judgment");
    expect(host.textContent).toContain("YOUR TENDENCY");
    expect(host.textContent).toContain("SHARE YOUR RESULT");
    // ShareRow carries the result-aware URL for this drill.
    const wa = host.querySelector('a[aria-label="Share IGL Decision Drill result on WhatsApp"]');
    expect(wa?.getAttribute("href")).toContain(encodeURIComponent("/bgmi-lab/igl-decision-drill?result=3-6"));
  });

  it("drills again from a clean slate after completion", () => {
    const host = renderShell();
    let continued = true;
    let rounds = 0;
    while (continued) {
      playScenario(host, rounds, true);
      continued = advance(host);
      rounds += 1;
    }
    expect(host.textContent).toContain("FINAL CALL");
    click(findButton(host, "Drill again")!);
    expect(host.textContent).toContain("CALL 01 / 06");
    expect(host.textContent).toContain("0 STRONGER");
    expect(host.textContent).not.toContain("FINAL CALL");
  });

  it("restarts mid-run without completing", () => {
    const host = renderShell();
    playScenario(host, 0, true);
    advance(host);
    expect(host.textContent).toContain("CALL 02 / 06");
    // Commit the second scenario, then restart from inside its debrief.
    playScenario(host, 1, true);
    click(findButton(host, "Restart")!);
    expect(host.textContent).toContain("CALL 01 / 06");
    expect(host.textContent).toContain("0 STRONGER");
  });
});
