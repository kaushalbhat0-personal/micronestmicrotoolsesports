// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { LootDashShell } from "./loot-dash-shell";

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

function stub2d(): void {
  const stub = new Proxy(
    {},
    {
      get: (_t, prop) => (typeof prop === "string" ? () => undefined : undefined),
      set: () => true,
    },
  );
  HTMLCanvasElement.prototype.getContext = (() => stub) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

let now = 0;
let rafQueue: Map<number, FrameRequestCallback>;
let rafId = 1;

function installRaf(): void {
  rafQueue = new Map();
  rafId = 1;
  (window as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (cb: FrameRequestCallback) => {
    const id = rafId++;
    rafQueue.set(id, cb);
    return id;
  };
  (window as unknown as { cancelAnimationFrame: unknown }).cancelAnimationFrame = (id: number) => {
    rafQueue.delete(id);
  };
  vi.spyOn(performance, "now").mockImplementation(() => now);
}

/** Advance the mocked clock; each generation of scheduled frames runs once. */
function tickFrames(ms: number, frameMs = 16.7): void {
  const frames = Math.max(1, Math.round(ms / frameMs));
  for (let i = 0; i < frames; i++) {
    now += frameMs;
    const pending = [...rafQueue.values()];
    rafQueue.clear();
    act(() => {
      for (const cb of pending) cb(now);
    });
  }
}

function renderShell(durationSec = 2) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root: Root = createRoot(host);
  act(() => {
    root.render(<LootDashShell durationSec={durationSec} />);
  });
  return { host, unmount: () => act(() => root.unmount()) };
}

function click(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function findButton(host: HTMLElement, text: string): HTMLButtonElement | undefined {
  return [...host.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent?.includes(text));
}

beforeEach(() => {
  now = 0;
  stub2d();
  stubMatchMedia(false);
  installRaf();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("loot dash — native controls and phases", () => {
  it("starts a run from the Start button and shows the live board", () => {
    const { host, unmount } = renderShell();
    try {
      expect(findButton(host, "Start Run")).toBeDefined();
      click(findButton(host, "Start Run")!);
      expect(host.textContent).toContain("LIVE RUN");
      expect(host.querySelector('canvas[data-board="loot-dash"]')).not.toBeNull();
      expect(findButton(host, "Pause")).toBeDefined();
    } finally {
      unmount();
    }
  });

  it("starts from the keyboard with Space", () => {
    const { host, unmount } = renderShell();
    try {
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      });
      expect(host.textContent).toContain("LIVE RUN");
    } finally {
      unmount();
    }
  });

  it("pauses and resumes without losing the run", () => {
    const { host, unmount } = renderShell();
    try {
      click(findButton(host, "Start Run")!);
      tickFrames(500);
      click(findButton(host, "Pause")!);
      expect(host.textContent).toContain("PAUSED");
      expect(findButton(host, "Resume")).toBeDefined();
      const frozen = host.textContent;
      tickFrames(500);
      expect(host.textContent).toBe(frozen);
      click(findButton(host, "Resume")!);
      expect(host.textContent).toContain("LIVE RUN");
    } finally {
      unmount();
    }
  });

  it("ends the run when the timer expires and announces the result", () => {
    const { host, unmount } = renderShell(2);
    try {
      click(findButton(host, "Start Run")!);
      tickFrames(2600);
      expect(host.textContent).toContain("RUN OVER");
      expect(findButton(host, "Play Again")).toBeDefined();
      const result = host.querySelector('[aria-live="polite"]');
      expect(result).not.toBeNull();
      expect(result!.textContent).toMatch(/pts/);
      expect(result!.textContent).toMatch(/PICKUPS/);
      expect(result!.textContent).toMatch(/BEST COMBO/);
    } finally {
      unmount();
    }
  });

  it("restarts cleanly with Play Again", () => {
    const { host, unmount } = renderShell(2);
    try {
      click(findButton(host, "Start Run")!);
      tickFrames(2600);
      expect(host.textContent).toContain("RUN OVER");
      click(findButton(host, "Play Again")!);
      expect(host.textContent).toContain("LIVE RUN");
      expect(host.textContent).toContain("0 PTS");
      tickFrames(2600);
      expect(host.textContent).toContain("RUN OVER");
    } finally {
      unmount();
    }
  });
});

describe("loot dash — canvas and accessibility contract", () => {
  it("renders an accessible, non-focusable canvas with the fixed logical aspect", () => {
    const { host, unmount } = renderShell();
    try {
      const canvas = host.querySelector("canvas")!;
      expect(canvas.getAttribute("role")).toBe("img");
      expect(canvas.getAttribute("aria-label")).toContain("Loot Dash arena");
      expect(canvas.hasAttribute("tabindex")).toBe(false);
      expect(canvas.style.aspectRatio).toBe("360 / 480");
      expect(canvas.className).toContain("h-auto");
      expect(canvas.className).toContain("w-full");
      expect(canvas.style.touchAction).toBe("none");
    } finally {
      unmount();
    }
  });

  it("keeps controls at 44px minimum and exposes game rules as text", () => {
    const { host, unmount } = renderShell();
    try {
      for (const b of host.querySelectorAll("button")) {
        expect(b.className).toContain("min-h-[44px]");
      }
      expect(host.textContent).toContain("WASD");
      expect(host.textContent).toContain("drag to steer");
      expect(host.querySelector("figcaption")).not.toBeNull();
    } finally {
      unmount();
    }
  });
});
