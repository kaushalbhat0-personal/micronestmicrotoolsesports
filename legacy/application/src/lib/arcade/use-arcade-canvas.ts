"use client";

import * as React from "react";
import { arcadeBackingSize, toLogicalCoords } from "./geometry";

/**
 * useArcadeCanvas — the only Canvas infrastructure interactive Lab games use.
 *
 * Owns: backing store (DPR capped at 2), ResizeObserver, the rAF loop with
 * clamped delta time, visibility auto-pause, pointer normalization into
 * logical coordinates, and full cleanup. Per-frame simulation state lives in
 * the caller's refs — this hook never triggers React renders per frame.
 *
 * The loop runs ONLY while `running` is true. When the document hides, the
 * loop stops and `onHiddenPause` fires once so the shell can enter a paused
 * phase instead of losing progress.
 */

export interface ArcadePointer {
  x: number;
  y: number;
  active: boolean;
}

export interface UseArcadeCanvasOptions {
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly running: boolean;
  readonly onFrame: (ctx: CanvasRenderingContext2D, dtSec: number) => void;
  readonly onHiddenPause?: () => void;
}

export function useArcadeCanvas(options: UseArcadeCanvasOptions): {
  readonly canvasRef: React.RefObject<HTMLCanvasElement | null>;
  readonly pointerRef: React.RefObject<ArcadePointer>;
} {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const pointerRef = React.useRef<ArcadePointer>({ x: 0, y: 0, active: false });
  const frameRef = React.useRef(options.onFrame);
  frameRef.current = options.onFrame;
  const pauseRef = React.useRef(options.onHiddenPause);
  pauseRef.current = options.onHiddenPause;
  const sizeRef = React.useRef({ w: options.logicalWidth, h: options.logicalHeight });

  const { logicalWidth, logicalHeight, running } = options;

  // Backing store + resize. One logical space at every size: height always
  // derives from the width via the logical aspect — no viewport branches.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    sizeRef.current = { w: logicalWidth, h: logicalHeight };
    const syncSize = (): void => {
      const rect = canvas.getBoundingClientRect();
      const cssWidth = rect.width > 0 ? rect.width : logicalWidth;
      const backing = arcadeBackingSize(cssWidth, logicalWidth, logicalHeight, window.devicePixelRatio);
      if (canvas.width !== backing.width || canvas.height !== backing.height) {
        canvas.width = backing.width;
        canvas.height = backing.height;
      }
      canvas.style.aspectRatio = `${logicalWidth} / ${logicalHeight}`;
    };
    syncSize();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(syncSize);
      observer.observe(canvas);
      return () => observer.disconnect();
    }
    return undefined;
  }, [logicalWidth, logicalHeight]);

  // Pointer normalization into logical coordinates. Games read pointerRef
  // during their frame — no React state, no re-renders.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = (clientX: number, clientY: number, active: boolean): void => {
      const rect = canvas.getBoundingClientRect();
      const { w, h } = sizeRef.current;
      const p = toLogicalCoords(rect, w, h, clientX, clientY);
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
        pointerRef.current = { x: p.x, y: p.y, active };
      }
    };
    const onDown = (e: PointerEvent): void => update(e.clientX, e.clientY, true);
    const onMove = (e: PointerEvent): void => {
      if (e.pointerType === "mouse" || pointerRef.current.active) update(e.clientX, e.clientY, e.pointerType === "mouse" ? true : pointerRef.current.active);
    };
    const onUp = (): void => {
      pointerRef.current = { ...pointerRef.current, active: false };
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onUp);
    };
  }, []);

  // rAF loop — active only while `running`. Delta is clamped so a background
  // tab resume can never teleport the simulation.
  React.useEffect(() => {
    if (!running) return;
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let stopped = false;
    let last = performance.now();
    const tick = (now: number): void => {
      if (stopped) return;
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
      last = now;
      const { w, h } = sizeRef.current;
      ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
      frameRef.current(ctx, dt);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    const onVisibility = (): void => {
      if (document.hidden) {
        stopped = true;
        window.cancelAnimationFrame(raf);
        pauseRef.current?.();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      window.cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [running]);

  return { canvasRef, pointerRef };
}
