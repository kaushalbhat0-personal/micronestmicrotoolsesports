"use client";

import * as React from "react";
import type {
  CircleIqCrossing,
  CircleIqLandmark,
  CircleIqOption,
  CircleIqRound,
  CircleIqRoutePoint,
} from "../data/circle-iq-logic";

/**
 * Circle IQ Canvas board renderer (POC).
 *
 * Pure presentation over the existing Circle IQ state machine: it draws the
 * authored 360×240 logical scene (zones, landmarks, routes, scout pins,
 * crossing pins, preview path, consequence traversal) and reports taps back
 * as logical coordinates. It never scores, never classifies, never mutates
 * game state — the shell owns `resolveMapTap`, scoring, tendency, seeds,
 * and completion exactly as before.
 *
 * One logical coordinate system only: every tap and every draw call goes
 * through BOARD_WIDTH × BOARD_HEIGHT. CSS size is handled with a bounded
 * DPR backing store (cap 2) and a ResizeObserver — no viewport branches.
 */

export const BOARD_WIDTH = 360;
export const BOARD_HEIGHT = 240;

/** Consequence traversal length. Must stay under the shell's 750ms verdict beat. */
export const BOARD_CONSEQUENCE_MS = 700;

export interface CircleIqBoardTap {
  readonly x: number;
  readonly y: number;
}

/**
 * Pure client → logical coordinate mapping. Tested at 360/390/412/624px
 * widths (and any other size) against the same 360×240 space the SVG used.
 */
export function toBoardCoords(
  rect: { readonly width: number; readonly height: number; readonly left?: number; readonly top?: number },
  clientX: number,
  clientY: number,
): CircleIqBoardTap {
  const left = rect.left ?? 0;
  const top = rect.top ?? 0;
  if (!(rect.width > 0) || !(rect.height > 0)) return { x: Number.NaN, y: Number.NaN };
  return {
    x: ((clientX - left) / rect.width) * BOARD_WIDTH,
    y: ((clientY - top) / rect.height) * BOARD_HEIGHT,
  };
}

/**
 * Backing-store size for a displayed CSS width. Height is always derived
 * from the 3:2 logical ratio — never from a clamped element box — so the
 * backing geometry and the displayed box can never disagree on aspect.
 * DPR is bounded to cap memory on high-density phones.
 */
export function boardBackingSize(
  cssWidth: number,
  devicePixelRatio: number | undefined,
): { readonly width: number; readonly height: number } {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(cssWidth * dpr));
  const height = Math.max(1, Math.round(((cssWidth * BOARD_HEIGHT) / BOARD_WIDTH) * dpr));
  return { width, height };
}

/** Cut a polyline at `fraction` of its length — the caught-open stop point. */
export function partialBoardPoints(
  points: readonly CircleIqRoutePoint[],
  fraction: number,
): CircleIqRoutePoint[] {
  if (points.length < 2) return [...points];
  const clamped = Math.min(Math.max(fraction, 0), 1);
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x;
    const dy = points[i]!.y - points[i - 1]!.y;
    const len = Math.hypot(dx, dy);
    lengths.push(len);
    total += len;
  }
  if (total === 0) return [points[0]!];
  const target = total * clamped;
  const out: CircleIqRoutePoint[] = [points[0]!];
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = lengths[i - 1]!;
    if (walked + seg >= target) {
      const t = seg === 0 ? 0 : (target - walked) / seg;
      out.push({
        x: points[i - 1]!.x + (points[i]!.x - points[i - 1]!.x) * t,
        y: points[i - 1]!.y + (points[i]!.y - points[i - 1]!.y) * t,
      });
      return out;
    }
    walked += seg;
    out.push(points[i]!);
  }
  return out;
}

/** Interpolate a marker along a polyline by progress 0..1 (pure, tested). */
export function pointAlongPath(
  points: readonly CircleIqRoutePoint[],
  progress: number,
): CircleIqRoutePoint | null {
  if (points.length === 0) return null;
  if (points.length === 1 || progress <= 0) return points[0]!;
  if (progress >= 1) return points[points.length - 1]!;
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const len = Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
    lengths.push(len);
    total += len;
  }
  if (total === 0) return points[0]!;
  let target = total * Math.min(Math.max(progress, 0), 1);
  for (let i = 1; i < points.length; i++) {
    const seg = lengths[i - 1]!;
    if (target <= seg) {
      const t = seg === 0 ? 0 : target / seg;
      return {
        x: points[i - 1]!.x + (points[i]!.x - points[i - 1]!.x) * t,
        y: points[i - 1]!.y + (points[i]!.y - points[i - 1]!.y) * t,
      };
    }
    target -= seg;
  }
  return points[points.length - 1]!;
}

export interface CircleIqBoardRouteView {
  readonly option: CircleIqOption;
  readonly dimmed: boolean;
  readonly highlighted: boolean;
  readonly committed: boolean;
  readonly committedStrong: boolean | null;
}

export interface CircleIqBoardScoutView {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly inspected: boolean;
  readonly disabled: boolean;
}

export interface CircleIqBoardCrossingView {
  readonly crossing: CircleIqCrossing;
  readonly letter: string;
  readonly selected: boolean;
  readonly disabled: boolean;
}

export type CircleIqBoardConsequenceKind = "arrived" | "caught-open" | "left-behind";

export interface CircleIqBoardConsequenceView {
  readonly kind: CircleIqBoardConsequenceKind;
  /** YOU → crossing → arrival polyline (crossing resolutions only). */
  readonly traversal: readonly CircleIqRoutePoint[] | null;
  readonly crossingPoint: { readonly x: number; readonly y: number } | null;
  readonly arrival: { readonly x: number; readonly y: number } | null;
  readonly spotted: boolean;
  /** Legacy caught-open stop polyline (no crossing resolution). */
  readonly stopPoints: readonly CircleIqRoutePoint[] | null;
  readonly stopEnd: { readonly x: number; readonly y: number } | null;
  /** Final YOU position; null keeps the marker at the player start. */
  readonly youFinal: { readonly x: number; readonly y: number } | null;
  readonly pulseLandmarkId: string | null;
}

export interface CircleIqBoardCanvasProps {
  readonly round: CircleIqRound;
  readonly routes: readonly CircleIqBoardRouteView[];
  readonly scouts: readonly CircleIqBoardScoutView[];
  readonly crossings: readonly CircleIqBoardCrossingView[];
  readonly previewPath: readonly CircleIqRoutePoint[] | null;
  readonly previewArrival: { readonly x: number; readonly y: number } | null;
  readonly consequence: CircleIqBoardConsequenceView | null;
  readonly committedRoutePoints: readonly CircleIqRoutePoint[];
  readonly boardLabel: string;
  readonly ariaLabel: string;
  readonly reducedMotion: boolean;
  readonly onBoardTap: (tap: CircleIqBoardTap) => void;
}

interface BoardPalette {
  foreground: string;
  foregroundMuted: string;
  card: string;
  borderStrong: string;
  surfaceMuted: string;
  primary: string;
  primaryInk: string;
  destructive: string;
  info: string;
}

const FALLBACK_PALETTE: BoardPalette = {
  foreground: "#26211b",
  foregroundMuted: "#6f675c",
  card: "#ffffff",
  borderStrong: "#cfc7b8",
  surfaceMuted: "#f5f3ee",
  primary: "#d9681e",
  primaryInk: "#8f4a12",
  destructive: "#d0442e",
  info: "#4d7a9e",
};

function readPalette(canvas: HTMLCanvasElement): BoardPalette {
  try {
    const styles = window.getComputedStyle(canvas);
    const get = (name: string, fallback: string): string => {
      const value = styles.getPropertyValue(name).trim();
      return value === "" ? fallback : value;
    };
    return {
      foreground: get("--color-foreground", FALLBACK_PALETTE.foreground),
      foregroundMuted: get("--color-foreground-muted", FALLBACK_PALETTE.foregroundMuted),
      card: get("--color-card", FALLBACK_PALETTE.card),
      borderStrong: get("--color-border-strong", FALLBACK_PALETTE.borderStrong),
      surfaceMuted: get("--color-surface-muted", FALLBACK_PALETTE.surfaceMuted),
      primary: get("--color-primary", FALLBACK_PALETTE.primary),
      primaryInk: get("--color-primary-ink", FALLBACK_PALETTE.primaryInk),
      destructive: get("--color-destructive", FALLBACK_PALETTE.destructive),
      info: get("--color-info", FALLBACK_PALETTE.info),
    };
  } catch {
    return FALLBACK_PALETTE;
  }
}

function tracePath(ctx: CanvasRenderingContext2D, points: readonly CircleIqRoutePoint[]): void {
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
}

function drawLandmark(
  ctx: CanvasRenderingContext2D,
  palette: BoardPalette,
  landmark: CircleIqLandmark,
  pulsed: boolean,
  progress: number,
): void {
  const { x, y, type } = landmark;
  ctx.save();
  if (pulsed) {
    // Landmark pulse: the CSS scale beat becomes a growing ring on Canvas.
    const ring = 18 + 10 * Math.abs(Math.sin(progress * Math.PI));
    ctx.beginPath();
    ctx.arc(x, y, ring, 0, Math.PI * 2);
    ctx.strokeStyle = palette.primary;
    ctx.globalAlpha = 0.55 * (1 - progress * 0.4);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  switch (type) {
    case "ridge": {
      ctx.beginPath();
      ctx.moveTo(x - 30, y + 12);
      ctx.lineTo(x, y - 14);
      ctx.lineTo(x + 30, y + 12);
      ctx.closePath();
      ctx.fillStyle = palette.surfaceMuted;
      ctx.fill();
      ctx.strokeStyle = palette.borderStrong;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y - 4, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = palette.foregroundMuted;
      ctx.fill();
      break;
    }
    case "compound": {
      ctx.beginPath();
      const rx = 3;
      const w = 24;
      const h = 24;
      if (typeof ctx.roundRect === "function") ctx.roundRect(x - 12, y - 12, w, h, rx);
      else ctx.rect(x - 12, y - 12, w, h);
      ctx.fillStyle = palette.surfaceMuted;
      ctx.fill();
      ctx.strokeStyle = palette.borderStrong;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 12, y - 2);
      ctx.lineTo(x, y - 12);
      ctx.lineTo(x + 12, y - 2);
      ctx.stroke();
      break;
    }
    case "open": {
      ctx.beginPath();
      ctx.ellipse(x, y, 42, 24, 0, 0, Math.PI * 2);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = palette.borderStrong;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      break;
    }
    case "road": {
      ctx.beginPath();
      ctx.moveTo(x - 45, y + 18);
      ctx.lineTo(x + 45, y - 18);
      ctx.setLineDash([8, 5]);
      ctx.strokeStyle = palette.borderStrong;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      break;
    }
    case "cover": {
      ctx.fillStyle = palette.primary;
      ctx.globalAlpha = 0.45;
      for (const [ox, oy, r] of [[-8, 4, 7], [7, -3, 9], [1, 8, 5]] as const) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "water": {
      ctx.beginPath();
      ctx.ellipse(x, y, 30, 16, 0, 0, Math.PI * 2);
      ctx.fillStyle = palette.info;
      ctx.globalAlpha = 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
  }
  ctx.restore();
}

function drawRoute(
  ctx: CanvasRenderingContext2D,
  palette: BoardPalette,
  view: CircleIqBoardRouteView,
): void {
  const { option } = view;
  const points = option.route.points;
  const stroke = view.committed
    ? view.committedStrong === true
      ? palette.primary
      : palette.destructive
    : view.highlighted
      ? palette.foreground
      : palette.borderStrong;
  const opacity = view.committed ? 1 : view.highlighted ? 1 : view.dimmed ? 0.22 : 0.6;
  const width = view.committed || view.highlighted ? 3.5 : 2;
  ctx.save();
  ctx.globalAlpha = opacity;
  if (option.route.style === "hold") {
    const at = points[0]!;
    ctx.beginPath();
    ctx.arc(at.x, at.y, 16, 0, Math.PI * 2);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }
  if (option.route.style === "open" && !view.committed) {
    tracePath(ctx, points);
    ctx.strokeStyle = palette.foreground;
    ctx.globalAlpha = opacity * 0.1;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.globalAlpha = opacity;
  }
  tracePath(ctx, points);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  if (option.route.style === "open" && !view.committed) ctx.setLineDash([7, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (option.route.style === "covered" && !view.committed) {
    // Hatch treatment: short cross-ticks along each segment, echoing the
    // SVG pattern overlay without any external asset.
    ctx.strokeStyle = palette.foreground;
    ctx.globalAlpha = opacity * (view.highlighted ? 0.85 : 0.5);
    ctx.lineWidth = 1.4;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      const segs = Math.max(1, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 9));
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const px = a.x + (b.x - a.x) * t;
        const py = a.y + (b.y - a.y) * t;
        ctx.beginPath();
        ctx.moveTo(px - 3.5, py - 3.5);
        ctx.lineTo(px + 3.5, py + 3.5);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = opacity;
  }
  const end = points[points.length - 1]!;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = stroke;
  ctx.fill();
  ctx.restore();
}

function drawScoutPin(
  ctx: CanvasRenderingContext2D,
  palette: BoardPalette,
  pin: CircleIqBoardScoutView,
): void {
  ctx.save();
  if (pin.disabled && !pin.inspected) ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.arc(pin.x, pin.y, 13, 0, Math.PI * 2);
  ctx.fillStyle = palette.card;
  ctx.fill();
  ctx.strokeStyle = pin.inspected ? palette.primary : palette.borderStrong;
  ctx.lineWidth = pin.inspected ? 2.5 : 2;
  if (!pin.inspected) ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = pin.inspected ? palette.primary : palette.foregroundMuted;
  ctx.font = "bold 11px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(pin.inspected ? "✓" : "?", pin.x, pin.y + 0.5);
  ctx.restore();
}

function drawCrossingPin(
  ctx: CanvasRenderingContext2D,
  palette: BoardPalette,
  pin: CircleIqBoardCrossingView,
): void {
  ctx.save();
  if (pin.disabled && !pin.selected) ctx.globalAlpha = 0.45;
  ctx.translate(pin.crossing.x, pin.crossing.y);
  ctx.rotate(Math.PI / 4);
  ctx.beginPath();
  const r = 6;
  const s = 12;
  ctx.moveTo(-s + r, -s);
  ctx.lineTo(s - r, -s);
  ctx.arcTo(s, -s, s, -s + r, r);
  ctx.lineTo(s, s - r);
  ctx.arcTo(s, s, s - r, s, r);
  ctx.lineTo(-s + r, s);
  ctx.arcTo(-s, s, -s, s - r, r);
  ctx.lineTo(-s, -s + r);
  ctx.arcTo(-s, -s, -s + r, -s, r);
  ctx.closePath();
  ctx.fillStyle = pin.selected ? palette.foreground : palette.card;
  ctx.fill();
  ctx.strokeStyle = pin.selected ? palette.foreground : palette.borderStrong;
  ctx.lineWidth = pin.selected ? 2.5 : 2;
  ctx.stroke();
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = pin.selected ? palette.card : palette.foregroundMuted;
  ctx.font = "bold 11px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(pin.letter, 0, 0.5);
  ctx.restore();
}

function drawBoard(
  ctx: CanvasRenderingContext2D,
  palette: BoardPalette,
  props: CircleIqBoardCanvasProps,
  progress: number,
): void {
  const { round, consequence } = props;
  ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  const ridge = round.landmarks.find((l) => l.type === "ridge") ?? null;
  if (ridge) {
    ctx.save();
    ctx.strokeStyle = palette.foreground;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    ctx.ellipse(ridge.x, ridge.y, 72, 40, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.ellipse(ridge.x, ridge.y, 52, 28, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.4;
    for (let i = -2; i <= 2; i++) {
      const tx = ridge.x + i * 18 - 6;
      const ty = ridge.y - 24;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + 6, ty - 10);
      ctx.lineTo(tx + 12, ty);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  const locked = consequence !== null;
  const showShiftedZone = locked && consequence.kind !== "arrived";
  const zoneCenter = showShiftedZone ? round.next.center : round.zone.center;
  const zoneRadius = showShiftedZone ? round.next.radius : round.zone.radius;

  ctx.save();
  ctx.beginPath();
  ctx.arc(zoneCenter.x, zoneCenter.y, zoneRadius, 0, Math.PI * 2);
  ctx.setLineDash([7, 6]);
  ctx.strokeStyle = palette.borderStrong;
  ctx.lineWidth = 1.25;
  ctx.globalAlpha = locked ? 0.25 : 0.55;
  ctx.stroke();
  ctx.restore();

  // NEXT anchor: terracotta ring + halo. During the consequence beat the
  // ring eases from 1.25× to 1× (the CSS ciq-tighten equivalent).
  const tighten = consequence !== null ? 1 + 0.25 * (1 - progress) : 1;
  ctx.save();
  ctx.beginPath();
  ctx.arc(round.next.center.x, round.next.center.y, round.next.radius, 0, Math.PI * 2);
  ctx.fillStyle = palette.primary;
  ctx.globalAlpha = locked && consequence.kind === "arrived" ? 0.22 : 0.14;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(round.next.center.x, round.next.center.y, round.next.radius * tighten, 0, Math.PI * 2);
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(round.next.center.x, round.next.center.y, round.next.radius + 8, 0, Math.PI * 2);
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = palette.primary;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.restore();

  for (const landmark of round.landmarks) {
    drawLandmark(ctx, palette, landmark, consequence?.pulseLandmarkId === landmark.id, progress);
  }

  for (const route of props.routes) drawRoute(ctx, palette, route);

  for (const pin of props.scouts) drawScoutPin(ctx, palette, pin);
  for (const pin of props.crossings) drawCrossingPin(ctx, palette, pin);

  if (props.previewPath !== null && props.previewArrival !== null && !locked) {
    ctx.save();
    tracePath(ctx, props.previewPath);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = palette.foreground;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.9;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(props.previewArrival.x, props.previewArrival.y, 6, 0, Math.PI * 2);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = palette.foreground;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  if (consequence !== null) {
    const revealed = progress >= 1;

    if (consequence.traversal !== null && consequence.crossingPoint !== null && consequence.arrival !== null) {
      const isCaught = consequence.kind === "caught-open";
      // Faint full-corridor ghost so the viewer keeps the whole option.
      if (isCaught && props.committedRoutePoints.length > 1) {
        ctx.save();
        tracePath(ctx, props.committedRoutePoints);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = palette.borderStrong;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.restore();
      }
      // Traversal reveal: progressive when arriving cleanly, full polyline
      // immediately when the beat is about the crossing cost.
      const drawn =
        consequence.kind === "arrived" && !revealed
          ? partialBoardPoints(consequence.traversal, progress)
          : consequence.traversal;
      ctx.save();
      tracePath(ctx, drawn);
      ctx.strokeStyle = consequence.spotted ? palette.destructive : palette.primary;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.stroke();
      ctx.restore();
      // Exposure ring at the crossing.
      ctx.save();
      ctx.beginPath();
      ctx.arc(consequence.crossingPoint.x, consequence.crossingPoint.y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = consequence.spotted ? palette.destructive : palette.primary;
      ctx.lineWidth = 2.5;
      if (!revealed && consequence.kind === "arrived") ctx.globalAlpha = 0.4 + 0.6 * progress;
      ctx.stroke();
      ctx.restore();
      if (consequence.spotted && revealed) {
        ctx.save();
        ctx.strokeStyle = palette.destructive;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        const { x, y } = consequence.crossingPoint;
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 8);
        ctx.lineTo(x + 8, y + 8);
        ctx.moveTo(x + 8, y - 8);
        ctx.lineTo(x - 8, y + 8);
        ctx.stroke();
        ctx.fillStyle = palette.destructive;
        ctx.font = "9px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText("S P O T T E D", x, y - 16);
        ctx.restore();
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(consequence.arrival.x, consequence.arrival.y, 6, 0, Math.PI * 2);
      ctx.strokeStyle = consequence.spotted ? palette.destructive : palette.primary;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    } else if (consequence.stopPoints !== null && consequence.stopEnd !== null) {
      // Legacy caught-open: the move died partway along the corridor.
      ctx.save();
      tracePath(ctx, props.committedRoutePoints);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = palette.borderStrong;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.restore();
      const drawn = revealed ? consequence.stopPoints : partialBoardPoints(consequence.stopPoints, progress);
      ctx.save();
      tracePath(ctx, drawn);
      ctx.strokeStyle = palette.destructive;
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      ctx.stroke();
      if (!revealed) {
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 7;
        ctx.stroke();
      }
      ctx.restore();
      if (revealed) {
        ctx.save();
        ctx.strokeStyle = palette.destructive;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        const { x, y } = consequence.stopEnd;
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 8);
        ctx.lineTo(x + 8, y + 8);
        ctx.moveTo(x + 8, y - 8);
        ctx.lineTo(x - 8, y + 8);
        ctx.stroke();
        ctx.restore();
      }
    } else if (consequence.kind === "left-behind") {
      ctx.save();
      ctx.beginPath();
      ctx.arc(round.player.x, round.player.y - 26, 10, 0, Math.PI * 2);
      ctx.fillStyle = palette.card;
      ctx.fill();
      ctx.strokeStyle = palette.destructive;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = palette.destructive;
      ctx.font = "bold 11px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", round.player.x, round.player.y - 25.5);
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillText("L A T E", round.player.x, round.player.y - 40);
      ctx.restore();
    }

    // YOU marker: travels the traversal while the beat runs, then rests.
    const marker =
      consequence.traversal !== null
        ? (pointAlongPath(consequence.traversal, progress) ?? { x: round.player.x, y: round.player.y })
        : (consequence.youFinal ?? { x: round.player.x, y: round.player.y });
    ctx.save();
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 11, 0, Math.PI * 2);
    ctx.strokeStyle = palette.primary;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = consequence.kind === "arrived" ? palette.primary : palette.destructive;
    ctx.fill();
    ctx.fillStyle = palette.foregroundMuted;
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("Y O U", marker.x, marker.y - 18);
    ctx.restore();
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.arc(round.player.x, round.player.y, 11, 0, Math.PI * 2);
    ctx.strokeStyle = palette.primary;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(round.player.x, round.player.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = palette.primary;
    ctx.fill();
    ctx.fillStyle = palette.foregroundMuted;
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("Y O U", round.player.x, round.player.y - 18);
    ctx.restore();
  }

  // Landmark + NEXT labels (mirrored in the DOM diagram key for SR users).
  ctx.save();
  ctx.font = "9px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = palette.foregroundMuted;
  for (const landmark of round.landmarks) {
    const lx = Math.min(Math.max(landmark.x, 52), 308);
    ctx.fillText(landmark.label.toUpperCase().slice(0, 20), lx, landmark.y + 30);
  }
  ctx.font = "10px ui-monospace, monospace";
  ctx.fillText("N E X T", round.next.center.x, round.next.center.y + 3);
  ctx.restore();
}

export function CircleIqBoardCanvas(props: CircleIqBoardCanvasProps): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const propsRef = React.useRef(props);
  propsRef.current = props;
  const [progress, setProgress] = React.useState(props.consequence === null || props.reducedMotion ? 1 : 0);
  const progressRef = React.useRef(progress);
  progressRef.current = progress;

  const consequenceActive = props.consequence !== null;
  const reducedMotion = props.reducedMotion;

  // Consequence traversal: one short rAF run, then the loop stops.
  // Reduced motion renders the final frame immediately with no loop.
  React.useEffect(() => {
    if (!consequenceActive) {
      setProgress(1);
      return;
    }
    if (reducedMotion) {
      setProgress(1);
      return;
    }
    if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
      setProgress(1);
      return;
    }
    let raf = 0;
    let stopped = false;
    const start = performance.now();
    const tick = (now: number): void => {
      if (stopped) return;
      const p = Math.min(1, (now - start) / BOARD_CONSEQUENCE_MS);
      setProgress(p);
      if (p < 1) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    const onVisibility = (): void => {
      if (document.hidden) {
        stopped = true;
        window.cancelAnimationFrame(raf);
        setProgress(1);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      window.cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [consequenceActive, reducedMotion, props.round.id, props.consequence?.kind]);

  // Backing store: logical 360×240 scaled by bounded DPR, refreshed on
  // resize. No viewport branches — one coordinate space at every size.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const syncSize = (): void => {
      const rect = canvas.getBoundingClientRect();
      const cssWidth = rect.width > 0 ? rect.width : BOARD_WIDTH;
      // The element box is always exactly 3:2 (fluid width + aspect-ratio,
      // no height cap), so the backing store derived here always matches
      // the displayed box — circles can never squash into ellipses.
      const backing = boardBackingSize(cssWidth, window.devicePixelRatio);
      if (canvas.width !== backing.width || canvas.height !== backing.height) {
        canvas.width = backing.width;
        canvas.height = backing.height;
      }
      canvas.style.aspectRatio = `${BOARD_WIDTH} / ${BOARD_HEIGHT}`;
      const palette = readPalette(canvas);
      ctx.setTransform(canvas.width / BOARD_WIDTH, 0, 0, canvas.height / BOARD_HEIGHT, 0, 0);
      drawBoard(ctx, palette, propsRef.current, progressRef.current);
    };
    syncSize();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(syncSize);
      observer.observe(canvas);
      return () => observer.disconnect();
    }
    return undefined;
  }, []);

  // Redraw on state/progress changes (no continuous loop otherwise).
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const palette = readPalette(canvas);
    ctx.setTransform(canvas.width / BOARD_WIDTH, 0, 0, canvas.height / BOARD_HEIGHT, 0, 0);
    drawBoard(ctx, palette, props, progress);
  });

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (typeof propsRef.current.onBoardTap !== "function") return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return;
    propsRef.current.onBoardTap(toBoardCoords(rect, event.clientX, event.clientY));
  };

  return (
    <>
      <span
        aria-hidden="true"
        className="absolute left-3 top-2.5 z-10 rounded-full border border-border bg-card/90 px-2 py-0.5 font-mono text-[10px] tracking-widest text-muted-foreground"
      >
        {props.boardLabel}
      </span>
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        role="img"
        aria-label={props.ariaLabel}
        data-board="circle-iq"
        className="h-auto w-full"
        style={{ aspectRatio: `${BOARD_WIDTH} / ${BOARD_HEIGHT}`, touchAction: "manipulation" }}
      />
    </>
  );
}
