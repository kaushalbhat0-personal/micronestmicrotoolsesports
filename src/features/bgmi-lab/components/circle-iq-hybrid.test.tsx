// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, afterEach } from "vitest";
import { CIRCLE_IQ_ROUNDS } from "../data/circle-iq-rounds";
import { CircleIqShell } from "./circle-iq-shell";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function stubMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function renderShell() {
  stubMatchMedia(false);
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  act(() => {
    root.render(<CircleIqShell />);
  });
  return { host, unmount: () => act(() => root.unmount()) };
}

function optionButtons(host: HTMLElement): HTMLButtonElement[] {
  return [...host.querySelectorAll<HTMLButtonElement>('div[role="group"][aria-label="Rotation options"] button')];
}

function findButton(host: HTMLElement, text: string): HTMLButtonElement | undefined {
  return [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.includes(text));
}

function click(el: HTMLElement) {
  act(() => {
    el.click();
  });
}

function keyDown(el: Element, key: string) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

function inspectButtons(host: HTMLElement): HTMLButtonElement[] {
  return [...host.querySelectorAll<HTMLButtonElement>('section[aria-label="Investigate"] button')];
}

function crossingListButtons(host: HTMLElement): HTMLButtonElement[] {
  return [...host.querySelectorAll<HTMLButtonElement>('section[aria-label="Crossings"] button')];
}

function crossingPins(host: HTMLElement): Element[] {
  return [...host.querySelectorAll('svg g.ciq-crossing[role="button"]')];
}

function routeTargets(host: HTMLElement): Element[] {
  return [...host.querySelectorAll('svg g.ciq-route-target[role="button"]')];
}

function mapSvg(host: HTMLElement): SVGSVGElement {
  const svg = host.querySelector<SVGSVGElement>("figure svg");
  if (!svg) throw new Error("game map svg missing");
  return svg;
}

function stubMapRect(svg: SVGSVGElement, width: number): number {
  const height = (width * 240) / 360;
  svg.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  return height;
}

function tapMap(svg: SVGSVGElement, vx: number, vy: number, width: number, height: number) {
  act(() => {
    svg.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        clientX: (vx / 360) * width,
        clientY: (vy / 240) * height,
      }),
    );
  });
}

function crossingPinCenters(host: HTMLElement): Array<{ x: number; y: number }> {
  return [...host.querySelectorAll("svg g.ciq-crossing")].map((g) => {
    const t = g.getAttribute("transform") ?? "";
    const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(t);
    if (!m) throw new Error(`crossing pin missing translate: ${t}`);
    return { x: Number(m[1]), y: Number(m[2]) };
  });
}

/** Find the authored round currently displayed by matching option labels. */
function displayedRound(host: HTMLElement) {
  const labels = optionButtons(host).map((b) => b.getAttribute("aria-label") ?? "");
  return CIRCLE_IQ_ROUNDS.find((r) => r.options.every((o) => labels.some((l) => l.includes(o.label))));
}

/** Locate a corridor with both a low and a high crossing (every round has one). */
function selectMixedCorridor(host: HTMLElement): { optionIndex: number; lowIndex: number; highIndex: number } | null {
  const round = displayedRound(host);
  if (!round) return null;
  const options = optionButtons(host);
  for (const option of round.options) {
    const crossings = option.crossings ?? [];
    const lowIndex = crossings.findIndex((c) => c.exposure === "low");
    const highIndex = crossings.findIndex((c) => c.exposure === "high");
    if (lowIndex < 0 || highIndex < 0) continue;
    const optionIndex = options.findIndex((b) => (b.getAttribute("aria-label") ?? "").includes(option.label));
    if (optionIndex < 0) continue;
    return { optionIndex, lowIndex, highIndex };
  }
  return null;
}

/** Click options in order until a move corridor (with crossings) is previewed. Returns the option index. */
function selectMoveCorridor(host: HTMLElement): number {
  const options = optionButtons(host);
  for (let i = 0; i < options.length; i++) {
    click(options[i]!);
    if (crossingListButtons(host).length > 0) return i;
  }
  return -1;
}

/** Click options in order until a hold corridor (no crossings, committable) is previewed. */
function selectHoldCorridor(host: HTMLElement): number {
  const options = optionButtons(host);
  for (let i = 0; i < options.length; i++) {
    click(options[i]!);
    if (crossingListButtons(host).length === 0 && findButton(host, "Commit to this call")?.disabled === false) return i;
  }
  return -1;
}

function commitReady(host: HTMLElement) {
  const commit = findButton(host, "Commit to this call");
  expect(commit, "commit must be reachable").toBeDefined();
  expect(commit!.disabled, "commit must be enabled").toBe(false);
  click(commit!);
}

const PRE_COMMIT_LEAK = /\b(covered|open|safer|risky|strong|weak|best|better|correct|wrong|optimal|exposed)\b/i;
const CROSSING_LEAK = /\b(best|better|strong|safe|safer|risky|riskier|correct|wrong|optimal|exposed|weak|good|bad)\b/i;

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("circle-iq V5 hybrid — full corridor → crossing → commit → debrief flow", () => {
  it("runs SCOUT → CORRIDOR → CROSSING → PREVIEW → COMMIT → CONSEQUENCE → DEBRIEF", () => {
    vi.useFakeTimers();
    const { host, unmount } = renderShell();
    try {
      click(inspectButtons(host)[0]!);
      const moveIndex = selectMoveCorridor(host);
      expect(moveIndex, "round must offer a move corridor").toBeGreaterThanOrEqual(0);
      expect(host.textContent).toContain("CROSS WHERE?");
      // Corridor alone is not committable.
      expect(findButton(host, "Commit to this call")!.disabled).toBe(true);

      const crossings = crossingListButtons(host);
      expect(crossings.length).toBe(2);
      click(crossings[0]!);
      expect(crossings[0]!.getAttribute("aria-pressed")).toBe("true");
      expect(host.textContent).toContain("Arrival marked on the map.");
      commitReady(host);

      expect(host.textContent).toContain("CONSEQUENCE");
      expect(host.textContent).toMatch(/CONSEQUENCE · (ARRIVED|CAUGHT OUT|LEFT BEHIND)/);
      expect(host.textContent).toContain("You crossed at");
      expect(host.textContent).not.toContain("Why:");
      act(() => {
        vi.advanceTimersByTime(800);
      });
      // Debrief: badge → crossing line → WHY → READ THIS → SCOUT NOTE.
      expect(host.textContent).toMatch(/Good read|Riskier read/);
      expect(host.textContent).toContain("You crossed at");
      expect(host.textContent).toContain("Why:");
      expect(host.textContent).toContain("READ THIS");
      expect(host.textContent).toMatch(/SCOUT NOTE · (Solved cold|Used 1 of 2|Used both)/);
      expect(host.textContent).toContain("Used 1 of 2");
    } finally {
      unmount();
    }
  });

  it("runs the hold shortcut: corridor → preview → commit with no crossing step", () => {
    vi.useFakeTimers();
    // Hold rounds are 3 of 8 — play through until one appears.
    for (let attempt = 0; attempt < 8; attempt++) {
      const { host, unmount } = renderShell();
      try {
        let foundHold = false;
        for (let round = 1; round <= 8; round++) {
          const holdIndex = selectHoldCorridor(host);
          if (holdIndex >= 0) {
            foundHold = true;
            expect(crossingListButtons(host)).toHaveLength(0);
            commitReady(host);
            expect(host.textContent).toContain("CONSEQUENCE");
            expect(host.textContent).toContain("LEFT BEHIND");
            act(() => {
              vi.advanceTimersByTime(800);
            });
            expect(host.textContent).toMatch(/Riskier read/);
            expect(host.textContent).not.toContain("You crossed at");
            break;
          }
          // Not a hold round — play it as a move round and continue.
          const moveIndex = selectMoveCorridor(host);
          expect(moveIndex).toBeGreaterThanOrEqual(0);
          click(crossingListButtons(host)[0]!);
          commitReady(host);
          act(() => {
            vi.advanceTimersByTime(800);
          });
          const next = findButton(host, round < 8 ? "Next round" : "See result");
          click(next!);
          if (round === 8) break;
        }
        if (foundHold) return;
      } finally {
        unmount();
      }
    }
    throw new Error("no hold corridor appeared in 8 attempts — bank must include hold options");
  });
});

describe("circle-iq V5 hybrid — crossing state rules", () => {
  it("treats a crossing-first map tap as corridor selection (no phantom crossing)", () => {
    const { host, unmount } = renderShell();
    try {
      const svg = mapSvg(host);
      const width = 280;
      const height = stubMapRect(svg, width);
      // Tap the middle of the map with no corridor selected: crossings are
      // unavailable, so this resolves to a corridor at most.
      tapMap(svg, 180, 120, width, height);
      for (const b of crossingListButtons(host)) {
        expect(b.getAttribute("aria-pressed")).toBe("false");
      }
      // A corridor may or may not have been hit — but no crossing is set.
      expect(host.textContent).not.toContain("Arrival marked on the map.");
    } finally {
      unmount();
    }
  });

  it("clears the crossing on corridor switch", () => {
    const { host, unmount } = renderShell();
    try {
      expect(selectMoveCorridor(host)).toBeGreaterThanOrEqual(0);
      click(crossingListButtons(host)[0]!);
      expect(crossingListButtons(host).filter((b) => b.getAttribute("aria-pressed") === "true")).toHaveLength(1);
      const options = optionButtons(host);
      const current = options.findIndex((o) => o.getAttribute("aria-pressed") === "true");
      const other = options[(current + 1) % options.length]!;
      click(other);
      for (const b of crossingListButtons(host)) {
        expect(b.getAttribute("aria-pressed")).toBe("false");
      }
      expect(host.textContent).not.toContain("Arrival marked on the map.");
    } finally {
      unmount();
    }
  });

  it("replaces the crossing when another is picked on the same corridor", () => {
    const { host, unmount } = renderShell();
    try {
      expect(selectMoveCorridor(host)).toBeGreaterThanOrEqual(0);
      const buttons = crossingListButtons(host);
      expect(buttons).toHaveLength(2);
      click(buttons[0]!);
      click(buttons[1]!);
      const pressed = crossingListButtons(host).filter((b) => b.getAttribute("aria-pressed") === "true");
      expect(pressed).toHaveLength(1);
      expect(pressed[0]).toBe(buttons[1]);
      // Map pin state follows the replacement.
      const pins = crossingPins(host);
      expect(pins.filter((p) => p.getAttribute("aria-pressed") === "true")).toHaveLength(1);
    } finally {
      unmount();
    }
  });

  it("locks corridor, crossing, and scouts after commit", () => {
    vi.useFakeTimers();
    const { host, unmount } = renderShell();
    try {
      click(inspectButtons(host)[0]!);
      expect(selectMoveCorridor(host)).toBeGreaterThanOrEqual(0);
      click(crossingListButtons(host)[0]!);
      commitReady(host);
      // Commit control leaves normal flow (no sticky/floating commit).
      expect(findButton(host, "Commit to this call")).toBeUndefined();
      // Crossing list is gone; pins are disabled; scouts are locked.
      expect(crossingListButtons(host)).toHaveLength(0);
      for (const p of crossingPins(host)) expect(p.getAttribute("aria-disabled")).toBe("true");
      for (const b of inspectButtons(host)) expect(b.disabled).toBe(true);
      for (const o of optionButtons(host)) expect(o.disabled).toBe(true);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(host.textContent).toMatch(/Good read|Riskier read/);
    } finally {
      unmount();
    }
  });

  it("keeps map pin and list selection in parity through one transition", () => {
    const { host, unmount } = renderShell();
    try {
      expect(selectMoveCorridor(host)).toBeGreaterThanOrEqual(0);
      // List → pin.
      click(crossingListButtons(host)[0]!);
      expect(crossingPins(host)[0]!.getAttribute("aria-pressed")).toBe("true");
      // Pin → list via the pin's own control (same transition as the list).
      const pin = crossingPins(host)[1]!;
      act(() => {
        pin.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      const buttons = crossingListButtons(host);
      expect(buttons[1]!.getAttribute("aria-pressed")).toBe("true");
      expect(buttons[0]!.getAttribute("aria-pressed")).toBe("false");
      expect(crossingPins(host)[1]!.getAttribute("aria-pressed")).toBe("true");
      expect(host.textContent).toContain("Arrival marked on the map.");
    } finally {
      unmount();
    }
  });
});

describe("circle-iq V5 hybrid — full run, restart, replay, share", () => {
  function playFullRun(host: HTMLElement) {
    for (let round = 1; round <= 8; round++) {
      const moveIndex = selectMoveCorridor(host);
      if (moveIndex >= 0) {
        click(crossingListButtons(host)[0]!);
      } else {
        // Hold round: committable without a crossing.
        expect(findButton(host, "Commit to this call")!.disabled).toBe(false);
      }
      commitReady(host);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      const next = findButton(host, round < 8 ? "Next round" : "See result");
      expect(next, `round ${round} advances`).toBeDefined();
      click(next!);
    }
  }

  it("completes 8 rounds with crossings, then reseeds on Play again", () => {
    vi.useFakeTimers();
    const { host, unmount } = renderShell();
    try {
      playFullRun(host);
      expect(host.textContent).toContain("FINAL READ");
      expect(host.textContent).toMatch(/\d \/ 8/);
      expect(host.textContent).toContain("SHARE YOUR RESULT");
      expect(host.textContent).toContain("YOUR TENDENCY");
      click(findButton(host, "Play again")!);
      // Crossing selection never persists across runs.
      expect(host.textContent).toContain("ROUND 01 / 08");
      expect(host.textContent).not.toContain("FINAL READ");
      expect(host.textContent).toContain("0 GOOD READS");
      expect(host.textContent).not.toContain("Arrival marked on the map.");
      expect(findButton(host, "Commit to this call")!.disabled).toBe(true);
    } finally {
      unmount();
    }
  });

  it("resets the run on Restart without persisting the crossing", () => {
    vi.useFakeTimers();
    const { host, unmount } = renderShell();
    try {
      const moveIndex = selectMoveCorridor(host);
      if (moveIndex >= 0) click(crossingListButtons(host)[0]!);
      commitReady(host);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      click(findButton(host, "Restart")!);
      expect(host.textContent).toContain("ROUND 01 / 08");
      expect(host.textContent).toContain("0 GOOD READS");
      expect(host.textContent).not.toContain("Arrival marked on the map.");
      expect(host.textContent).toContain("SCOUTS: 2");
    } finally {
      unmount();
    }
  });

  it("reports scout use honestly across cold, partial, and full use", () => {
    vi.useFakeTimers();
    const cold = renderShell();
    try {
      const moveIndex = selectMoveCorridor(cold.host);
      if (moveIndex >= 0) click(crossingListButtons(cold.host)[0]!);
      commitReady(cold.host);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(cold.host.textContent).toContain("Solved cold");
    } finally {
      cold.unmount();
    }
    const full = renderShell();
    try {
      click(inspectButtons(full.host)[0]!);
      click(inspectButtons(full.host)[1]!);
      const moveIndex = selectMoveCorridor(full.host);
      if (moveIndex >= 0) click(crossingListButtons(full.host)[0]!);
      commitReady(full.host);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(full.host.textContent).toContain("Used both scouts");
    } finally {
      full.unmount();
    }
  });
});

describe("circle-iq V5 hybrid — responsive crossing taps", () => {
  it.each([360, 390, 412, 624])("resolves crossing taps at %dpx with matching map/list state", (width) => {
    const { host, unmount } = renderShell();
    try {
      const svg = mapSvg(host);
      const height = stubMapRect(svg, width);
      expect(selectMoveCorridor(host)).toBeGreaterThanOrEqual(0);
      const pins = crossingPinCenters(host);
      expect(pins).toHaveLength(2);
      tapMap(svg, pins[0]!.x, pins[0]!.y, width, height);
      const buttons = crossingListButtons(host);
      expect(buttons[0]!.getAttribute("aria-pressed")).toBe("true");
      expect(crossingPins(host)[0]!.getAttribute("aria-pressed")).toBe("true");
      expect(host.textContent).toContain("Arrival marked on the map.");
      expect(findButton(host, "Commit to this call")!.disabled).toBe(false);
    } finally {
      unmount();
    }
  });

  it("resolves nearby crossing taps deterministically with matching state", () => {
    const { host, unmount } = renderShell();
    try {
      const svg = mapSvg(host);
      const width = 390;
      const height = stubMapRect(svg, width);
      expect(selectMoveCorridor(host)).toBeGreaterThanOrEqual(0);
      const pins = crossingPinCenters(host);
      const mid = { x: (pins[0]!.x + pins[1]!.x) / 2, y: (pins[0]!.y + pins[1]!.y) / 2 };
      // Same input twice → same output (nearest-target dispatch is pure).
      tapMap(svg, mid.x, mid.y, width, height);
      const onceList = crossingListButtons(host).map((b) => b.getAttribute("aria-pressed")).join(",");
      const oncePins = crossingPins(host).map((p) => p.getAttribute("aria-pressed")).join(",");
      tapMap(svg, mid.x, mid.y, width, height);
      expect(crossingListButtons(host).map((b) => b.getAttribute("aria-pressed")).join(",")).toBe(onceList);
      expect(crossingPins(host).map((p) => p.getAttribute("aria-pressed")).join(",")).toBe(oncePins);
      // Map and list always agree.
      expect(oncePins).toBe(onceList);
    } finally {
      unmount();
    }
  });

  it("keeps commit full-width in normal flow with no sticky positioning", () => {
    const { host, unmount } = renderShell();
    try {
      expect(selectMoveCorridor(host)).toBeGreaterThanOrEqual(0);
      click(crossingListButtons(host)[0]!);
      const commit = findButton(host, "Commit to this call")!;
      expect(commit.className).toContain("w-full");
      expect(commit.className).not.toMatch(/fixed|sticky/);
    } finally {
      unmount();
    }
  });
});

describe("circle-iq V5 polish — rendered exposure consequence", () => {
  it("renders no SPOTTED beat for a low-exposure crossing in the shell", () => {
    vi.useFakeTimers();
    const { host, unmount } = renderShell();
    try {
      const found = selectMixedCorridor(host);
      expect(found, "every round offers a low/high corridor").not.toBeNull();
      click(optionButtons(host)[found!.optionIndex]!);
      click(crossingListButtons(host)[found!.lowIndex]!);
      commitReady(host);
      expect(host.textContent).toContain("CONSEQUENCE");
      expect(host.textContent).toContain("You crossed at");
      expect(host.textContent).not.toContain("SPOTTED");
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(host.textContent).toMatch(/Good read|Riskier read/);
      expect(host.textContent).not.toContain("SPOTTED");
    } finally {
      unmount();
    }
  });

  it("renders the SPOTTED beat for a high-exposure crossing on the same corridor", () => {
    vi.useFakeTimers();
    const { host, unmount } = renderShell();
    try {
      const found = selectMixedCorridor(host);
      expect(found, "every round offers a low/high corridor").not.toBeNull();
      click(optionButtons(host)[found!.optionIndex]!);
      click(crossingListButtons(host)[found!.highIndex]!);
      commitReady(host);
      expect(host.textContent).toContain("CONSEQUENCE");
      expect(host.textContent).toContain("SPOTTED");
      expect(host.textContent).toContain("You crossed at");
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(host.textContent).toMatch(/Good read|Riskier read/);
      expect(host.textContent).toContain("SPOTTED");
    } finally {
      unmount();
    }
  });

  it("renders the authored arrival marker and preview path through the selected crossing", () => {
    const { host, unmount } = renderShell();
    try {
      const found = selectMixedCorridor(host);
      expect(found).not.toBeNull();
      const round = displayedRound(host)!;
      const option = round.options.find((o) =>
        (optionButtons(host)[found!.optionIndex]!.getAttribute("aria-label") ?? "").includes(o.label),
      )!;
      const crossing = option.crossings![found!.lowIndex]!;
      click(optionButtons(host)[found!.optionIndex]!);
      click(crossingListButtons(host)[found!.lowIndex]!);
      const svg = mapSvg(host);
      const arrival = [...svg.querySelectorAll("circle")].find(
        (c) =>
          c.getAttribute("cx") === String(crossing.arrival.x) &&
          c.getAttribute("cy") === String(crossing.arrival.y) &&
          c.getAttribute("stroke-dasharray") === "3 3",
      );
      expect(arrival, `arrival marker at (${crossing.arrival.x},${crossing.arrival.y})`).toBeDefined();
      const preview = [...svg.querySelectorAll("path")].find(
        (p) =>
          p.getAttribute("stroke-dasharray") === "6 4" &&
          (p.getAttribute("d") ?? "").includes(`${crossing.arrival.x} ${crossing.arrival.y}`),
      );
      expect(preview, "preview path reaches the authored arrival").toBeDefined();
    } finally {
      unmount();
    }
  });
});

describe("circle-iq V5 hybrid — keyboard, exposure leak guards, reduced motion", () => {
  it("supports a keyboard-only corridor → crossing → commit flow", () => {
    vi.useFakeTimers();
    const { host, unmount } = renderShell();
    try {
      const routes = routeTargets(host);
      expect(routes.length).toBeGreaterThanOrEqual(2);
      keyDown(routes[0]!, "Enter");
      expect(host.textContent).toContain("PREVIEW");
      const pins = crossingPins(host);
      if (pins.length > 0) {
        expect(pins[0]!.getAttribute("tabindex")).toBe("0");
        expect(pins[0]!.getAttribute("aria-label")).toMatch(/^Crossing [AB]: /);
        keyDown(pins[0]!, " ");
        expect(crossingListButtons(host)[0]!.getAttribute("aria-pressed")).toBe("true");
      }
      commitReady(host);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(host.textContent).toMatch(/Good read|Riskier read/);
    } finally {
      unmount();
    }
  });

  it("labels every crossing accessibly in the pin and the list", () => {
    const { host, unmount } = renderShell();
    try {
      expect(selectMoveCorridor(host)).toBeGreaterThanOrEqual(0);
      for (const p of crossingPins(host)) {
        expect(p.getAttribute("role")).toBe("button");
        expect(p.getAttribute("aria-label")).toMatch(/^Crossing [AB]: .+\. .+ Preview the crossing\.$/);
      }
      for (const b of crossingListButtons(host)) {
        expect(b.getAttribute("aria-pressed")).toBeDefined();
        expect(b.getAttribute("aria-label")).toMatch(/^Crossing [AB]: /);
        expect(b.className).toContain("min-h-[44px]");
        expect(b.className).toContain("w-full");
      }
    } finally {
      unmount();
    }
  });

  it("never leaks exposure, SPOTTED, or crossing notes before commit", () => {
    const { host, unmount } = renderShell();
    try {
      expect(selectMoveCorridor(host)).toBeGreaterThanOrEqual(0);
      click(crossingListButtons(host)[0]!);
      expect(host.textContent).not.toContain("SPOTTED");
      expect(host.textContent).not.toContain("You crossed at");
      expect(host.textContent).not.toMatch(/low exposure|high exposure/i);
      const preview = [...host.querySelectorAll("p")].find((p) => p.textContent?.includes("PREVIEW"))!;
      expect(preview.textContent).not.toMatch(PRE_COMMIT_LEAK);
      expect(preview.textContent).not.toMatch(CROSSING_LEAK);
      for (const b of crossingListButtons(host)) {
        expect(b.textContent).not.toMatch(CROSSING_LEAK);
      }
    } finally {
      unmount();
    }
  });

  it("renders the final crossing consequence immediately under reduced motion", () => {
    vi.useFakeTimers();
    stubMatchMedia(true);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    act(() => {
      root.render(<CircleIqShell />);
    });
    try {
      const moveIndex = selectMoveCorridor(host);
      if (moveIndex >= 0) click(crossingListButtons(host)[0]!);
      commitReady(host);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(host.textContent).toContain("CONSEQUENCE");
      expect(host.textContent).toMatch(/CONSEQUENCE · (ARRIVED|CAUGHT OUT|LEFT BEHIND)/);
      expect(host.textContent).toMatch(/Good read|Riskier read/);
      if (moveIndex >= 0) expect(host.textContent).toContain("You crossed at");
      expect(host.querySelector(".ciq-you-move")).toBeNull();
      expect(host.querySelector(".ciq-route-draw")).toBeNull();
    } finally {
      act(() => root.unmount());
    }
  });
});
