// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createRoot, type Root } from "react-dom/client";
import { createRng, range } from "@/lib/arcade/rng";
import { arcadeBackingSize, circlesOverlap, clamp, toLogicalCoords } from "@/lib/arcade/geometry";
import { useArcadeCanvas } from "@/lib/arcade/use-arcade-canvas";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function stub2d(): void {
  const stub = new Proxy(
    {},
    {
      get: (target, prop) => {
        if (prop === "canvas") return document.createElement("canvas");
        return typeof prop === "string" ? () => undefined : undefined;
      },
      set: () => true,
    },
  );
  HTMLCanvasElement.prototype.getContext = (() => stub) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

describe("arcade runtime — seeded rng", () => {
  it("reproduces the same sequence from the same seed", () => {
    const a = createRng(99);
    const b = createRng(99);
    expect(Array.from({ length: 20 }, () => a())).toEqual(Array.from({ length: 20 }, () => b()));
  });

  it("differs across seeds and stays in helper ranges", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a()).not.toBe(b());
    const r = createRng(7);
    for (let i = 0; i < 200; i++) {
      const v = range(r, 10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });
});

describe("arcade runtime — geometry", () => {
  it("clamps and detects circle overlap", () => {
    expect(clamp(99, 0, 10)).toBe(10);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(circlesOverlap(0, 0, 5, 8, 0, 5)).toBe(true);
    expect(circlesOverlap(0, 0, 5, 11, 0, 5)).toBe(false);
  });

  it("sizes the backing store at the exact logical aspect with DPR capped at 2", () => {
    for (const width of [256, 320, 360, 390, 412, 540, 611, 624, 720]) {
      const backing = arcadeBackingSize(width, 360, 480, 1);
      expect(backing.width).toBe(width);
      expect(backing.height).toBe(Math.round((width * 480) / 360));
      expect(backing.width / backing.height).toBeCloseTo(360 / 480, 2);
    }
    expect(arcadeBackingSize(390, 360, 480, 3)).toEqual(arcadeBackingSize(390, 360, 480, 2));
    expect(arcadeBackingSize(390, 360, 480, undefined)).toEqual({ width: 390, height: 520 });
  });

  it("normalizes pointer coordinates into logical space", () => {
    const p = toLogicalCoords({ width: 360, height: 480, left: 0, top: 0 }, 360, 480, 180, 240);
    expect(p).toEqual({ x: 180, y: 240 });
    const offset = toLogicalCoords({ width: 180, height: 240, left: 10, top: 20 }, 360, 480, 100, 140);
    expect(offset.x).toBeCloseTo(180, 9);
    expect(offset.y).toBeCloseTo(240, 9);
    expect(toLogicalCoords({ width: 0, height: 0 }, 360, 480, 5, 5).x).toBeNaN();
  });
});

describe("arcade runtime — canvas hook lifecycle", () => {
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let rafId: number;

  function installRaf(): void {
    rafCallbacks = new Map();
    rafId = 1;
    (window as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (cb: FrameRequestCallback) => {
      const id = rafId++;
      rafCallbacks.set(id, cb);
      return id;
    };
    (window as unknown as { cancelAnimationFrame: unknown }).cancelAnimationFrame = (id: number) => {
      rafCallbacks.delete(id);
    };
  }

  function Probe({ running, onFrame, onHiddenPause }: { running: boolean; onFrame: () => void; onHiddenPause?: (() => void) | undefined }) {
    const { canvasRef } = useArcadeCanvas({
      logicalWidth: 360,
      logicalHeight: 480,
      running,
      onFrame: () => onFrame(),
      ...(onHiddenPause ? { onHiddenPause } : {}),
    });
    return <canvas ref={canvasRef} className="h-auto w-full" style={{ aspectRatio: "360 / 480" }} />;
  }

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("renders a fluid box with the logical aspect and no height cap", () => {
    stub2d();
    installRaf();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    act(() => {
      root.render(<Probe running={false} onFrame={() => undefined} />);
    });
    const canvas = host.querySelector("canvas")!;
    expect(canvas.className).toContain("h-auto");
    expect(canvas.className).toContain("w-full");
    expect(canvas.className).not.toContain("max-h-");
    expect(canvas.style.aspectRatio).toBe("360 / 480");
    act(() => root.unmount());
  });

  it("runs frames only while active and cancels on unmount", () => {
    stub2d();
    installRaf();
    const frames: number[] = [];
    let rafCalls = 0;
    const origRaf = window.requestAnimationFrame as unknown as (cb: FrameRequestCallback) => number;
    (window as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = (cb: FrameRequestCallback) => {
      rafCalls += 1;
      return origRaf(cb);
    };
    const cancels: number[] = [];
    const origCancel = window.cancelAnimationFrame as unknown as (id: number) => void;
    (window as unknown as { cancelAnimationFrame: unknown }).cancelAnimationFrame = (id: number) => {
      cancels.push(id);
      origCancel(id);
    };
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    act(() => {
      root.render(<Probe running={true} onFrame={() => frames.push(1)} />);
    });
    expect(rafCalls).toBeGreaterThanOrEqual(1);
    act(() => root.unmount());
    expect(cancels.length).toBeGreaterThanOrEqual(1);
  });

  it("fires the hidden-pause callback when the tab hides", () => {
    stub2d();
    installRaf();
    let paused = 0;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root: Root = createRoot(host);
    act(() => {
      root.render(<Probe running={true} onFrame={() => undefined} onHiddenPause={() => (paused += 1)} />);
    });
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    expect(paused).toBe(1);
    act(() => root.unmount());
  });
});

describe("arcade + loot dash — safety boundary", () => {
  it("introduces no network, storage, tracking, or ad surface", () => {
    const files = [
      "src/lib/arcade/rng.ts",
      "src/lib/arcade/geometry.ts",
      "src/lib/arcade/use-arcade-canvas.ts",
      "src/features/bgmi-lab/components/loot-dash-sim.ts",
      "src/features/bgmi-lab/components/loot-dash-theme.ts",
      "src/features/bgmi-lab/components/loot-dash-shell.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
      for (const banned of [
        "localStorage",
        "sessionStorage",
        "document.cookie",
        "fetch(",
        "XMLHttpRequest",
        "WebSocket",
        "analytics",
        "leaderboard",
        "adsbygoogle",
        "ca-pub",
        "<iframe",
      ]) {
        expect(codeOnly, `${file} must not contain ${banned}`).not.toContain(banned);
      }
      if (!file.endsWith("rng.ts")) {
        expect(codeOnly, `${file} must not use uncontrolled Math.random`).not.toContain("Math.random");
      }
    }
  });
});
