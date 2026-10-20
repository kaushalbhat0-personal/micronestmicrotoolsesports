// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

function keyEnter(el: Element) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
}

function inspectButtons(host: HTMLElement): HTMLButtonElement[] {
  return [...host.querySelectorAll<HTMLButtonElement>('section[aria-label="Investigate"] button')];
}

function scoutTargets(host: HTMLElement): Element[] {
  return [...host.querySelectorAll('svg g.ciq-scout[role="button"]')];
}

function crossingListButtons(host: HTMLElement): HTMLButtonElement[] {
  return [...host.querySelectorAll<HTMLButtonElement>('section[aria-label="Crossings"] button')];
}

/** V5 Hybrid: move corridors need a crossing before commit; hold skips it. */
function ensureCrossing(host: HTMLElement) {
  const first = crossingListButtons(host)[0];
  if (first) click(first);
}

function crossingTargets(host: HTMLElement): Element[] {
  return [...host.querySelectorAll('svg g.ciq-crossing[role="button"]')];
}

function routeTargets(host: HTMLElement): Element[] {
  return [...host.querySelectorAll('svg g.ciq-route-target[role="button"]')];
}

const PRE_COMMIT_LEAK = /\b(covered|open|safer|risky|strong|weak|best|better|correct|wrong|optimal|exposed)\b/i;

function mapSvg(host: HTMLElement): SVGSVGElement {
  const svg = host.querySelector<SVGSVGElement>("figure svg");
  if (!svg) throw new Error("game map svg missing");
  return svg;
}

/** Stub a mobile/desktop map width; returns the matching height. */
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

function pinCenters(host: HTMLElement): Array<{ x: number; y: number }> {
  return [...host.querySelectorAll("svg g.ciq-scout")].map((g) => {
    const t = g.getAttribute("transform") ?? "";
    const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(t);
    if (!m) throw new Error(`scout pin missing translate: ${t}`);
    return { x: Number(m[1]), y: Number(m[2]) };
  });
}

function corridorMidpoints(host: HTMLElement): string[] {
  return [...host.querySelectorAll("svg g.ciq-route-target path[d]")].map((p) => p.getAttribute("d") ?? "");
}

function longestSegmentMid(d: string): { x: number; y: number } | null {
  const nums = d.replace(/[ML]/g, " ").trim().split(/\s+/).map(Number);
  if (nums.length < 4 || nums.some((n) => !Number.isFinite(n))) return null;
  let best: { x: number; y: number } | null = null;
  let bestLen = -1;
  for (let i = 0; i + 3 < nums.length; i += 2) {
    const ax = nums[i]!;
    const ay = nums[i + 1]!;
    const bx = nums[i + 2]!;
    const by = nums[i + 3]!;
    const len = Math.hypot(bx - ax, by - ay);
    if (len > bestLen) {
      bestLen = len;
      best = { x: (ax + bx) / 2, y: (ay + by) / 2 };
    }
  }
  return bestLen > 0 ? best : null;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("circle-iq V3 interaction — preview before commit", () => {
  it("disables commit before any preview and previews without scoring or revealing", () => {
    const { host, unmount } = renderShell();
    try {
      const commit = findButton(host, "Commit to this call");
      expect(commit).toBeDefined();
      expect(commit!.disabled).toBe(true);

      click(optionButtons(host)[0]!);
      expect(optionButtons(host)[0]!.getAttribute("aria-pressed")).toBe("true");
      // V5 Hybrid: a corridor alone is not committable — the crossing
      // decision comes first (hold corridors skip it).
      const crossings = crossingListButtons(host);
      if (crossings.length > 0) {
        expect(findButton(host, "Commit to this call")!.disabled).toBe(true);
        expect(host.textContent).toContain("Pick a crossing");
        click(crossings[0]!);
        expect(findButton(host, "Commit to this call")!.disabled).toBe(false);
      } else {
        expect(findButton(host, "Commit to this call")!.disabled).toBe(false);
      }
      // Preview caption appears, but nothing is scored or revealed.
      expect(host.textContent).toContain("PREVIEW");
      expect(host.textContent).not.toContain("Good read");
      expect(host.textContent).not.toContain("Riskier read");
      expect(host.textContent).not.toContain("CONSEQUENCE");
      expect(host.textContent).toContain("0 GOOD READS");
    } finally {
      unmount();
    }
  });

  it("switching preview never scores and never locks", () => {
    const { host, unmount } = renderShell();
    try {
      const options = optionButtons(host);
      click(options[0]!);
      if (options.length > 1) click(options[1]!);
      const pressed = options.map((o) => o.getAttribute("aria-pressed"));
      expect(pressed.filter((p) => p === "true")).toHaveLength(1);
      expect(options.every((o) => !o.disabled)).toBe(true);
      expect(host.textContent).toContain("0 GOOD READS");
      expect(host.textContent).not.toContain("Why:");
    } finally {
      unmount();
    }
  });
});

describe("circle-iq V3 interaction — commit then consequence then verdict", () => {
  it("shows consequence first and verdict only after the beat", () => {
    vi.useFakeTimers();
    const { host, unmount } = renderShell();
    try {
      click(optionButtons(host)[0]!);
      ensureCrossing(host);
      click(findButton(host, "Commit to this call")!);
      // Consequence state is visible; the verdict is not.
      expect(host.textContent).toContain("CONSEQUENCE");
      expect(host.textContent).not.toContain("Why:");
      expect(optionButtons(host).every((o) => o.disabled)).toBe(true);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(host.textContent).toContain("Why:");
      expect(host.textContent).toMatch(/Good read|Riskier read/);
      expect(host.textContent).toContain("READ THIS");
    } finally {
      unmount();
    }
  });

  it("scores exactly once and reflects the committed option id", () => {
    vi.useFakeTimers();
    const { host, unmount } = renderShell();
    try {
      click(optionButtons(host)[0]!);
      ensureCrossing(host);
      click(findButton(host, "Commit to this call")!);
      // Locked: further taps cannot change the pick.
      click(optionButtons(host)[0]!);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      const good = host.textContent?.includes("Good read") ?? false;
      expect(host.textContent).toContain(good ? "1 GOOD READ" : "0 GOOD READS");
      expect(findButton(host, "Commit to this call")).toBeUndefined();
    } finally {
      unmount();
    }
  });

  it("resolves the final consequence frame under reduced motion", () => {
    vi.useFakeTimers();
    stubMatchMedia(true);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    act(() => {
      root.render(<CircleIqShell />);
    });
    try {
      click(optionButtons(host)[0]!);
      ensureCrossing(host);
      click(findButton(host, "Commit to this call")!);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(host.textContent).toContain("Why:");
      expect(host.textContent).toMatch(/Good read|Riskier read/);
    } finally {
      act(() => root.unmount());
    }
  });
});

describe("circle-iq V3 interaction — full run on buttons alone, then replay", () => {
  it("completes 8 rounds with keyboard-operable buttons only, then reseeds on play again", () => {
    vi.useFakeTimers();
    const { host, unmount } = renderShell();
    try {
      for (let round = 1; round <= 8; round++) {
        click(optionButtons(host)[0]!);
        ensureCrossing(host);
        click(findButton(host, "Commit to this call")!);
        act(() => {
          vi.advanceTimersByTime(800);
        });
        const next = findButton(host, round < 8 ? "Next round" : "See result");
        expect(next, `round ${round} advances`).toBeDefined();
        click(next!);
      }
      expect(host.textContent).toContain("FINAL READ");
      expect(host.textContent).toMatch(/\d \/ 8/);
      expect(host.textContent).toContain("SHARE YOUR RESULT");
      expect(host.textContent).toContain("YOUR TENDENCY");
      expect(host.textContent).toContain("New order, same 8 calls");
      click(findButton(host, "Play again")!);
      expect(host.textContent).toContain("ROUND 01 / 08");
      expect(host.textContent).not.toContain("FINAL READ");
      expect(host.textContent).toContain("0 GOOD READS");
    } finally {
      unmount();
    }
  });
});

describe("circle-iq V3 safety regressions", () => {
  it("keeps the island free of storage, network, ads, billing, and claim language", () => {
    const strip = (source: string): string =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    const base = join(process.cwd(), "src/features/bgmi-lab");
    for (const file of ["components/circle-iq-shell.tsx", "data/circle-iq-logic.ts", "data/circle-iq-rounds.ts"]) {
      const code = strip(readFileSync(join(base, file), "utf8"));
      for (const banned of [
        "localStorage",
        "sessionStorage",
        "document.cookie",
        "fetch(",
        "XMLHttpRequest",
        "analytics",
        "leaderboard",
        "adsbygoogle",
        "ca-pub",
        "dodopayments",
        "razorpay",
        "billing",
        "entitlement",
      ]) {
        expect(code, `${file} must not contain ${banned}`).not.toContain(banned);
      }
    }
    const shell = readFileSync(join(process.cwd(), "src/features/bgmi-lab/components/circle-iq-shell.tsx"), "utf8");
    for (const marker of ["Demo shell", "full mechanics arrive later", "Try it — pick the rotation"]) {
      expect(shell).not.toContain(marker);
    }
  });
});

describe("circle-iq V4 interaction — scout budget and inspect list", () => {
  it("starts with 2 scouts, spends one per target, and floors at zero", () => {
    const { host, unmount } = renderShell();
    try {
      expect(host.textContent).toContain("SCOUTS: 2");
      const buttons = inspectButtons(host);
      expect(buttons.length).toBeGreaterThanOrEqual(3);
      expect(buttons.length).toBeLessThanOrEqual(4);
      // Inspect list mirrors every SVG scout target exactly.
      expect(scoutTargets(host)).toHaveLength(buttons.length);

      click(buttons[0]!);
      expect(host.textContent).toContain("SCOUTS: 1");
      expect(buttons[0]!.getAttribute("aria-pressed")).toBe("true");

      // Same target never consumes twice.
      click(buttons[0]!);
      expect(host.textContent).toContain("SCOUTS: 1");

      click(buttons[1]!);
      expect(host.textContent).toContain("SCOUTS: 0");
      // Remaining uninspected controls lock; inspected ones stay readable.
      const rest = inspectButtons(host).slice(2);
      for (const b of rest) expect(b.disabled).toBe(true);
    } finally {
      unmount();
    }
  });

  it("reveals authored intel facts without leaking verdict or grade", () => {
    const { host, unmount } = renderShell();
    try {
      const buttons = inspectButtons(host);
      click(buttons[0]!);
      const card = buttons[0]!.closest("div")!;
      expect(card.textContent).toMatch(/.{20,}/);
      expect(card.textContent).not.toMatch(/\b(correct|wrong|best|strong|weak|verdict|score)\b/i);
    } finally {
      unmount();
    }
  });

  it("locks scouting after commit", () => {
    vi.useFakeTimers();
    const { host, unmount } = renderShell();
    try {
      click(inspectButtons(host)[0]!);
      click(optionButtons(host)[0]!);
      ensureCrossing(host);
      click(findButton(host, "Commit to this call")!);
      for (const b of inspectButtons(host)) expect(b.disabled).toBe(true);
      act(() => {
        vi.advanceTimersByTime(800);
      });
    } finally {
      unmount();
    }
  });
});

describe("circle-iq V4 interaction — neutral preview, commit, differentiated consequence", () => {
  it("previews neutral geometry with no answer-quality terminology", () => {
    const { host, unmount } = renderShell();
    try {
      click(optionButtons(host)[0]!);
      const preview = [...host.querySelectorAll("p")].find((p) => p.textContent?.includes("PREVIEW"))!;
      expect(preview).toBeDefined();
      expect(preview.textContent).not.toMatch(PRE_COMMIT_LEAK);
      // Corridor-only preview asks for the crossing; the completed
      // preview (or a hold corridor) invites the commit.
      const crossings = crossingListButtons(host);
      if (crossings.length > 0) {
        expect(preview.textContent).toMatch(/Pick a crossing/);
        click(crossings[0]!);
        const done = [...host.querySelectorAll("p")].find((p) => p.textContent?.includes("PREVIEW"))!;
        expect(done.textContent).toMatch(/Commit to lock this call/);
        expect(done.textContent).not.toMatch(PRE_COMMIT_LEAK);
      } else {
        expect(preview.textContent).toMatch(/Commit to lock this call/);
      }
    } finally {
      unmount();
    }
  });

  it("runs scout → scout → preview → commit → consequence → verdict", () => {
    vi.useFakeTimers();
    const { host, unmount } = renderShell();
    try {
      const buttons = inspectButtons(host);
      click(buttons[0]!);
      click(buttons[1]!);
      expect(host.textContent).toContain("SCOUTS: 0");
      click(optionButtons(host)[0]!);
      ensureCrossing(host);
      click(findButton(host, "Commit to this call")!);
      expect(host.textContent).toContain("CONSEQUENCE");
      expect(host.textContent).toMatch(/CONSEQUENCE · (ARRIVED|CAUGHT OUT|LEFT BEHIND)/);
      expect(host.textContent).not.toContain("Why:");
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(host.textContent).toMatch(/Good read|Riskier read/);
      expect(host.textContent).toContain("READ THIS");
      expect(host.textContent).toMatch(/SCOUT NOTE · (Solved cold|Used 1 of 2|Used both)/);
    } finally {
      unmount();
    }
  });

  it("runs scout → route → commit and no-scout → route → commit", () => {
    vi.useFakeTimers();
    const first = renderShell();
    try {
      click(inspectButtons(first.host)[0]!);
      click(optionButtons(first.host)[0]!);
      ensureCrossing(first.host);
      click(findButton(first.host, "Commit to this call")!);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(first.host.textContent).toMatch(/Good read|Riskier read/);
      expect(first.host.textContent).toMatch(/Used 1 of 2/);
    } finally {
      first.unmount();
    }
    const second = renderShell();
    try {
      click(optionButtons(second.host)[0]!);
      ensureCrossing(second.host);
      click(findButton(second.host, "Commit to this call")!);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(second.host.textContent).toMatch(/Good read|Riskier read/);
      expect(second.host.textContent).toMatch(/Solved cold/);
    } finally {
      second.unmount();
    }
  });
});

describe("circle-iq responsive hardening — map tap dispatch", () => {
  it("taps a scout pin via the map the same as its list button", () => {
    for (const width of [256, 310, 332, 624]) {
      const { host, unmount } = renderShell();
      try {
        const svg = mapSvg(host);
        const height = stubMapRect(svg, width);
        const pins = pinCenters(host);
        expect(pins.length).toBeGreaterThanOrEqual(3);
        tapMap(svg, pins[0]!.x, pins[0]!.y, width, height);
        // Identical outcome to clicking the mirrored list control.
        expect(host.textContent).toContain("SCOUTS: 1");
        expect(inspectButtons(host)[0]!.getAttribute("aria-pressed")).toBe("true");
      } finally {
        unmount();
      }
    }
  });

  it("spends exactly one scout on a direct pin click (no double dispatch)", () => {
    const { host, unmount } = renderShell();
    try {
      // SVG <g> has no .click(); dispatch like a real pointer hit instead.
      // Target carries data-map-target, so the svg-level dispatcher skips it.
      const pin = scoutTargets(host)[0]!;
      act(() => {
        pin.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(host.textContent).toContain("SCOUTS: 1");
      expect(host.textContent).not.toContain("SCOUTS: 0");
    } finally {
      unmount();
    }
  });

  it("taps a corridor via the map the same as its option button", () => {
    const { host, unmount } = renderShell();
    try {
      const svg = mapSvg(host);
      const width = 280;
      const height = stubMapRect(svg, width);
      const mids = corridorMidpoints(host)
        .map(longestSegmentMid)
        .filter((m): m is { x: number; y: number } => m !== null);
      expect(mids.length).toBeGreaterThanOrEqual(2);
      let previewLetter: string | null = null;
      let previewCaption = "";
      for (const mid of mids) {
        tapMap(svg, mid.x, mid.y, width, height);
        const m = /PREVIEW · ROUTE ([ABC]) · ([^.]+)/.exec(host.textContent ?? "");
        if (m) {
          previewLetter = m[1]!;
          previewCaption = m[2]!;
          break;
        }
      }
      expect(previewLetter, "a corridor tap previews a route").not.toBeNull();
      // Clicking a different option changes the preview; re-clicking the
      // map-tapped letter restores its exact caption — same transition.
      const options = optionButtons(host);
      const other = options.find((o) => !o.getAttribute("aria-label")?.includes(`Option ${previewLetter}:`));
      click(other!);
      expect(host.textContent).not.toContain(previewCaption);
      const same = options.find((o) => o.getAttribute("aria-label")?.includes(`Option ${previewLetter}:`));
      click(same!);
      expect(host.textContent).toContain(previewCaption);
    } finally {
      unmount();
    }
  });

  it("ignores taps far outside every target", () => {
    const { host, unmount } = renderShell();
    try {
      const svg = mapSvg(host);
      stubMapRect(svg, 280);
      tapMap(svg, -100, -100, 280, (280 * 240) / 360);
      expect(host.textContent).toContain("SCOUTS: 2");
      expect(host.textContent).not.toContain("PREVIEW");
      expect(optionButtons(host).every((o) => o.getAttribute("aria-pressed") === "false")).toBe(true);
    } finally {
      unmount();
    }
  });
});

describe("circle-iq V4 interaction — keyboard and reduced motion", () => {
  it("supports keyboard-only map inspect, route preview, commit, and next", () => {
    vi.useFakeTimers();
    const { host, unmount } = renderShell();
    try {
      const targets = scoutTargets(host);
      expect(targets.length).toBeGreaterThanOrEqual(3);
      keyEnter(targets[0]!);
      expect(host.textContent).toContain("SCOUTS: 1");

      const routes = routeTargets(host);
      expect(routes.length).toBeGreaterThanOrEqual(2);
      keyEnter(routes[0]!);
      expect(host.textContent).toContain("PREVIEW");

      // Keyboard-only crossing: focus the first crossing pin and confirm.
      const crossings = crossingTargets(host);
      if (crossings.length > 0) {
        keyEnter(crossings[0]!);
        expect(crossingListButtons(host)[0]!.getAttribute("aria-pressed")).toBe("true");
      }

      click(findButton(host, "Commit to this call")!);
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(host.textContent).toMatch(/Good read|Riskier read/);
      const next = findButton(host, "Next round") ?? findButton(host, "See result");
      expect(next).toBeDefined();
      next!.focus();
      expect(document.activeElement).toBe(next);
    } finally {
      unmount();
    }
  });

  it("renders the final consequence frame under reduced motion without animation timing", () => {
    vi.useFakeTimers();
    stubMatchMedia(true);
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    act(() => {
      root.render(<CircleIqShell />);
    });
    try {
      click(inspectButtons(host)[0]!);
      click(optionButtons(host)[0]!);
      ensureCrossing(host);
      click(findButton(host, "Commit to this call")!);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(host.textContent).toContain("CONSEQUENCE");
      expect(host.textContent).toMatch(/CONSEQUENCE · (ARRIVED|CAUGHT OUT|LEFT BEHIND)/);
      expect(host.textContent).toMatch(/Good read|Riskier read/);
      // No traversal tween runs — the final frame is immediate.
      expect(host.querySelector(".ciq-you-move")).toBeNull();
      expect(host.querySelector(".ciq-route-draw")).toBeNull();
    } finally {
      act(() => root.unmount());
    }
  });
});
