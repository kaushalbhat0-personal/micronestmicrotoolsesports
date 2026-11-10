// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRoot, type Root } from "react-dom/client";
import {
  BOARD_CONSEQUENCE_MS,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CircleIqBoardCanvas,
  boardBackingSize,
  partialBoardPoints,
  pointAlongPath,
  toBoardCoords,
} from "./circle-iq-board-canvas";
import { CIRCLE_IQ_ROUNDS } from "../data/circle-iq-rounds";
import { resolveMapTap } from "../data/circle-iq-logic";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const round = CIRCLE_IQ_ROUNDS[0]!;

function baseProps(overrides: Partial<React.ComponentProps<typeof CircleIqBoardCanvas>> = {}) {
  return {
    round,
    routes: [],
    scouts: [],
    crossings: [],
    previewPath: null,
    previewArrival: null,
    consequence: null,
    committedRoutePoints: [],
    boardLabel: "TACTICAL BOARD",
    ariaLabel: `Tactical snapshot: ${round.title}. ${round.situation}`,
    reducedMotion: false,
    onBoardTap: () => undefined,
    ...overrides,
  };
}

function renderBoard(props: React.ComponentProps<typeof CircleIqBoardCanvas>) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  act(() => {
    root.render(<CircleIqBoardCanvas {...props} />);
  });
  return { host, unmount: () => act(() => root.unmount()) };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("circle-iq board canvas — logical coordinate contract", () => {
  it("uses the existing 360×240 authored space with no viewport branches", () => {
    expect(BOARD_WIDTH).toBe(360);
    expect(BOARD_HEIGHT).toBe(240);
  });

  it("keeps the consequence beat inside the shell verdict window", () => {
    expect(BOARD_CONSEQUENCE_MS).toBeLessThanOrEqual(750);
  });

  it.each([360, 390, 412, 624])("normalizes taps at %dpx to the same logical target", (width) => {
    const height = (width * 240) / 360;
    // A tap on the authored player-adjacent scout pin in CSS pixels.
    const pin = round.reveals[0]!;
    const tap = toBoardCoords(
      { width, height, left: 0, top: 0 },
      (pin.x / 360) * width,
      (pin.y / 240) * height,
    );
    expect(tap.x).toBeCloseTo(pin.x, 9);
    expect(tap.y).toBeCloseTo(pin.y, 9);
  });

  it("respects rect offsets instead of assuming a full-viewport canvas", () => {
    const width = 328;
    const height = (width * 240) / 360;
    const tap = toBoardCoords({ width, height, left: 16, top: 120 }, 16 + width / 2, 120 + height / 2);
    expect(tap.x).toBeCloseTo(180, 9);
    expect(tap.y).toBeCloseTo(120, 9);
  });

  it("returns NaN for zero-size rects so the caller no-ops", () => {
    const tap = toBoardCoords({ width: 0, height: 0, left: 0, top: 0 }, 10, 10);
    expect(tap.x).toBeNaN();
  });
});

describe("circle-iq board canvas — 3:2 aspect contract (no distortion)", () => {
  it.each([256, 320, 360, 390, 412, 540, 611, 624, 720])(
    "sizes the backing store at exactly 3:2 for a %dpx CSS width",
    (width) => {
      const backing = boardBackingSize(width, 1);
      // Displayed box (fluid width + aspect-ratio, no height cap) and
      // backing store always agree: circles cannot squash into ellipses.
      // Integer backing pixels allow at most 1px of rounding either way.
      expect(backing.width).toBe(width);
      expect(backing.height).toBe(Math.round((width * BOARD_HEIGHT) / BOARD_WIDTH));
      expect(backing.width / backing.height).toBeCloseTo(BOARD_WIDTH / BOARD_HEIGHT, 2);
    },
  );

  it("bounds DPR at 2 so high-density phones never blow up the backing store", () => {
    expect(boardBackingSize(390, 3)).toEqual(boardBackingSize(390, 2));
    expect(boardBackingSize(390, 2)).toEqual({ width: 780, height: 520 });
    expect(boardBackingSize(390, undefined)).toEqual({ width: 390, height: 260 });
  });

  it("renders the canvas element with a fluid 3:2 box and no height cap", () => {
    const { host, unmount } = renderBoard(baseProps());
    try {
      const canvas = host.querySelector("canvas")!;
      expect(canvas.className).toContain("h-auto");
      expect(canvas.className).toContain("w-full");
      expect(canvas.className).not.toContain("max-h-");
      expect(canvas.style.aspectRatio).toBe(`${BOARD_WIDTH} / ${BOARD_HEIGHT}`);
    } finally {
      unmount();
    }
  });
});

describe("circle-iq board canvas — pure geometry helpers", () => {
  it("cuts a polyline at a fraction of its length", () => {
    const cut = partialBoardPoints(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      0.55,
    );
    expect(cut.length).toBeGreaterThanOrEqual(2);
    // 55% of 200 units lands 10 units down the second segment.
    const end = cut[cut.length - 1]!;
    expect(end.x).toBeCloseTo(100, 9);
    expect(end.y).toBeCloseTo(10, 9);
  });

  it("interpolates a marker along the traversal without drifting off-path", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 40 },
    ];
    expect(pointAlongPath(path, 0)).toEqual({ x: 0, y: 0 });
    expect(pointAlongPath(path, 1)).toEqual({ x: 60, y: 40 });
    const mid = pointAlongPath(path, 0.5)!;
    expect(mid.x).toBeCloseTo(50, 9);
    expect(mid.y).toBeCloseTo(0, 9);
  });

  it("matches the shell stop-point convention for caught-open", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ];
    const stop = partialBoardPoints(path, 0.55);
    expect(stop[stop.length - 1]!.x).toBeCloseTo(110, 9);
  });
});

describe("circle-iq board canvas — rendering contract (jsdom, no 2d context)", () => {
  it("renders an accessible img with the snapshot label and board affordance", () => {
    const { host, unmount } = renderBoard(baseProps());
    try {
      const canvas = host.querySelector("canvas");
      expect(canvas, "board canvas exists").not.toBeNull();
      expect(canvas!.getAttribute("role")).toBe("img");
      expect(canvas!.getAttribute("aria-label")).toContain("Tactical snapshot:");
      expect(canvas!.getAttribute("data-board")).toBe("circle-iq");
      // Canvas is display-only: never focusable, never a keyboard trap.
      expect(canvas!.hasAttribute("tabindex")).toBe(false);
    } finally {
      unmount();
    }
  });

  it("reports taps as logical coordinates for the shared resolveMapTap dispatch", () => {
    const seen: Array<{ x: number; y: number }> = [];
    const { host, unmount } = renderBoard(baseProps({ onBoardTap: (t) => seen.push(t) }));
    try {
      const canvas = host.querySelector("canvas")!;
      const width = 390;
      const height = (width * 240) / 360;
      canvas.getBoundingClientRect = () =>
        ({ left: 8, top: 4, right: 8 + width, bottom: 4 + height, width, height, x: 8, y: 4, toJSON: () => ({}) }) as DOMRect;
      const pin = round.reveals[1]!;
      act(() => {
        canvas.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            clientX: 8 + (pin.x / 360) * width,
            clientY: 4 + (pin.y / 240) * height,
          }),
        );
      });
      expect(seen).toHaveLength(1);
      expect(seen[0]!.x).toBeCloseTo(pin.x, 6);
      expect(seen[0]!.y).toBeCloseTo(pin.y, 6);
      // The reported tap resolves through the SAME dispatcher the shell uses.
      const corridors = round.options.map((o) => ({ optionId: o.id, points: o.route.points }));
      const hit = resolveMapTap(
        round.reveals.map((r) => ({ id: r.id, x: r.x, y: r.y, target: "scout" as const })),
        corridors,
        seen[0]!.x,
        seen[0]!.y,
      );
      expect(hit).toEqual({ kind: "pin", id: pin.id });
    } finally {
      unmount();
    }
  });

  it("runs one short rAF traversal for the consequence, then stops", () => {
    const raf = vi.fn(() => 7);
    const cancel = vi.fn();
    (window as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = raf;
    (window as unknown as { cancelAnimationFrame: unknown }).cancelAnimationFrame = cancel;
    const consequence = {
      kind: "arrived" as const,
      traversal: [
        { x: round.player.x, y: round.player.y },
        { x: round.player.x + 10, y: round.player.y + 10 },
      ],
      crossingPoint: null,
      arrival: { x: round.player.x + 10, y: round.player.y + 10 },
      spotted: false,
      stopPoints: null,
      stopEnd: null,
      youFinal: { x: round.player.x + 10, y: round.player.y + 10 },
      pulseLandmarkId: null,
    };
    const { unmount } = renderBoard(baseProps({ consequence, reducedMotion: false }));
    try {
      expect(raf, "consequence schedules exactly one rAF chain start").toHaveBeenCalledTimes(1);
    } finally {
      unmount();
    }
    expect(cancel, "unmount cancels the loop").toHaveBeenCalled();
  });

  it("schedules no animation frames under reduced motion", () => {
    const raf = vi.fn(() => 7);
    (window as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = raf;
    const consequence = {
      kind: "arrived" as const,
      traversal: [
        { x: round.player.x, y: round.player.y },
        { x: round.player.x + 10, y: round.player.y + 10 },
      ],
      crossingPoint: null,
      arrival: { x: round.player.x + 10, y: round.player.y + 10 },
      spotted: false,
      stopPoints: null,
      stopEnd: null,
      youFinal: { x: round.player.x + 10, y: round.player.y + 10 },
      pulseLandmarkId: null,
    };
    const { host, unmount } = renderBoard(baseProps({ consequence, reducedMotion: true }));
    try {
      expect(raf, "reduced motion renders the final frame with no loop").not.toHaveBeenCalled();
      expect(host.querySelector("canvas")).not.toBeNull();
    } finally {
      unmount();
    }
  });
});

describe("circle-iq board canvas — safety boundary", () => {
  it("introduces no network, storage, or ad surface", () => {
    const source = readFileSync(join(process.cwd(), "src/features/bgmi-lab/components/circle-iq-board-canvas.tsx"), "utf8");
    const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
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
      "<iframe",
      "dodopayments",
      "razorpay",
      "billing",
      "entitlement",
    ]) {
      expect(codeOnly, `board renderer must not contain ${banned}`).not.toContain(banned);
    }
  });
});
